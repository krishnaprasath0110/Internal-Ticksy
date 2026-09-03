import chromadb
from app.core.config import settings
import pandas as pd
import os
import logging
from typing import List, Dict, Optional
import jellyfish
import google.generativeai as genai
from io import BytesIO

logger = logging.getLogger(__name__)

# Global variables
_client = None
_collection = None
_faq_data = []  # Store FAQ data in memory
_batch_collections = {}  # Store collections per batch: {batch_id: collection}
_batch_faq_data = {}  # Store FAQ data in memory per batch: {batch_id: [faq_data]}


def get_batch_collection_name(batch_id: int) -> str:
    """Get the collection name for a batch"""
    return f"faq_collection_batch_{batch_id}"


def delete_collection(collection_name: str):
    """Delete a collection from ChromaDB"""
    try:
        if _client:
            # Delete the collection
            _client.delete_collection(name=collection_name)
            print(f"Collection '{collection_name}' deleted successfully.")
        else:
            print("ChromaDB client is not initialized.")
    except Exception as e:
        print(f"Error deleting collection: {e}")


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings using Gemini model"""
    try:
        embeddings = []
        for text in texts:
            result = genai.embed_content(
                model="gemini-embedding-001",
                content=text
            )
            embeddings.append(result["embedding"])
        return embeddings
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        # Return None for each text as fallback
        return [None] * len(texts)


def initialize_chromadb():
    """Initialize ChromaDB with persistent storage"""
    global _client, _collection

    try:
        # Create persistent client
        persist_directory = os.path.join(os.path.dirname(settings.FAQ_EXCEL_PATH), "chroma_db")
        _client = chromadb.PersistentClient(path=persist_directory)

        # Initialize Gemini
        genai.configure(api_key=settings.GEMINI_API_KEY)

        # Check if collection exists and get it
        try:
            _collection = _client.get_collection(name="faq_collection")
            logger.info("Using existing FAQ collection")
            # delete_collection('faq_collection')
            # logger.info("Deleted existing FAQ collection")
            # _collection = _client.create_collection(
            #     name="faq_collection"
            # )
            # logger.info("Created new FAQ collection")
            # Load FAQ data for new collection
            # load_faq_data()
            # Load FAQ data into memory without recreating collection
            load_faq_data_to_memory()
        except Exception as e:
            logger.info(f"Creating new FAQ collection: {str(e)}")
            _collection = _client.create_collection(
                name="faq_collection"
            )
            logger.info("Created new FAQ collection")
            # Load FAQ data for new collection
            load_faq_data()

        # Initialize batch-wise collections
        initialize_batch_collections()

        logger.info("ChromaDB initialized successfully")

    except Exception as e:
        logger.error(f"Failed to initialize ChromaDB: {str(e)}")
        raise Exception(f"Failed to initialize ChromaDB: {str(e)}")


def load_faq_data_to_memory():
    """Load FAQ data from existing collection to memory without recreating the collection"""
    global _faq_data
    
    try:
        # Get all FAQs from collection
        all_faqs = _collection.get()
        
        if not all_faqs['metadatas']:
            logger.warning("No FAQ data found in existing collection")
            return
            
        # Store FAQ data in memory for similarity search
        _faq_data = [
            {
                "question": str(question),
                "answer": str(metadata["answer"]),
                "id": str(id)
            }
            for question, metadata, id in zip(all_faqs['documents'], all_faqs['metadatas'], all_faqs['ids'])
        ]
        
        logger.info(f"Loaded {len(_faq_data)} existing FAQs into memory")
        
    except Exception as e:
        logger.error(f"Failed to load FAQ data to memory: {str(e)}", exc_info=True)


def load_faq_data():
    """Load FAQ data from Excel file and create embeddings"""
    global _faq_data
    
    try:
        # Read Excel file
        df = pd.read_excel(settings.FAQ_EXCEL_PATH)
        logger.info(f"Loaded {len(df)} FAQs from Excel")

        # Validate columns
        if 'Question' not in df.columns or 'Answer' not in df.columns:
            raise ValueError("Excel file must have 'Question' and 'Answer' columns")

        # Clean data
        df = df.dropna(subset=['Question', 'Answer'])

        # Get questions and answers
        questions = df['Question'].tolist()
        answers = df['Answer'].tolist()

        if not questions:
            raise ValueError("No valid questions found in Excel file")

        logger.info(f"Processing {len(questions)} valid FAQ entries")

        # Generate embeddings for questions
        logger.info("Generating embeddings for questions...")
        embeddings = generate_embeddings(questions)
        
        # Store FAQ data in memory for similarity search
        _faq_data = [
            {
                "question": str(question),
                "answer": str(answer),
                "id": str(i)
            }
            for i, (question, answer) in enumerate(zip(questions, answers))
        ]

        # Add to collection with embeddings
        for i, (question, answer, embedding) in enumerate(zip(questions, answers, embeddings)):
            if embedding:  # Only add if embedding was successfully generated
                _collection.add(
                    documents=[question],
                    embeddings=[embedding],
                    metadatas=[{
                        "answer": str(answer),
                        "source": "excel",
                        "question": str(question)
                    }],
                    ids=[str(i)]
                )

        logger.info("FAQ data loaded successfully with embeddings")

    except Exception as e:
        logger.error(f"Failed to load FAQ data: {str(e)}", exc_info=True)
        raise Exception(f"Failed to load FAQ data: {str(e)}")


def calculate_similarity(query: str, text: str) -> float:
    """Calculate similarity between query and text using Jaro-Winkler distance"""
    # For very short queries, we need a stricter comparison
    query_lower = query.lower().strip()
    text_lower = text.lower().strip()
    
    # Count words in query
    query_word_count = len(query_lower.split())
    
    # For very short queries (1-2 words), use a higher threshold internally
    if query_word_count <= 2:
        # If the query is just 1-2 words, it must be an exact substring to be considered
        if query_word_count == 1 and len(query_lower) <= 3:
            # For single words with 3 or fewer chars, require exact match
            return 1.0 if query_lower in text_lower.split() else 0.0
        else:
            # For short queries, check if it's a substantial part of any text
            return 1.0 if query_lower in text_lower else 0.0
    
    # For longer queries, use Jaro-Winkler similarity
    return jellyfish.jaro_winkler_similarity(query_lower, text_lower)


def find_similar_answer(query: str, threshold: float = 0.5) -> str:
    """Find most similar answer for a query using embeddings and text similarity"""
    try:
        if not _collection:
            raise ValueError("ChromaDB collection not initialized")

        # First try using embeddings for semantic search
        top_results = []
        try:
            # Generate embedding for query
            query_embedding = genai.embed_content(
                model="gemini-embedding-001",
                content=query
            )
            
            # Search using embedding
            results = _collection.query(
                query_embeddings=[query_embedding["embedding"]],
                n_results=5
            )
            
            if results and results['metadatas'] and len(results['metadatas'][0]) > 0:
                # Format results into top_results list
                for question, metadata in zip(results['documents'][0], results['metadatas'][0]):
                    top_results.append({
                        'question': question,
                        'answer': metadata['answer']
                    })
                logger.info(f"Found {len(top_results)} results using embedding search")
                
        except Exception as e:
            logger.warning(f"Embedding search failed, falling back to text similarity: {str(e)}")
        
        # Fall back to text similarity if embedding search fails or returns no results
        if not top_results:
            logger.info("Embedding search returned no results, falling back to text similarity")
            
            # Get all FAQs
            all_faqs = _collection.get()
            
            if not all_faqs['metadatas']:
                return None
                
            # Adjust threshold based on query length
            query_word_count = len(query.strip().split())
            adjusted_threshold = threshold
            if query_word_count <= 2:
                adjusted_threshold = 0.7  # Higher threshold for very short queries
            elif query_word_count <= 5:
                adjusted_threshold = 0.5  # Medium threshold for short queries
                
            # Log the query details
            logger.info(f"Query: '{query}', Word count: {query_word_count}, Threshold: {adjusted_threshold}")

            # Calculate similarity for each question
            similarities = []
            for i, question in enumerate(all_faqs['documents']):
                similarity = calculate_similarity(query, question)
                if similarity >= adjusted_threshold:
                    similarities.append({
                        'index': i,
                        'similarity': similarity,
                        'question': all_faqs['metadatas'][i]['question'],
                        'answer': all_faqs['metadatas'][i]['answer']
                    })
                    logger.debug(f"Match found: '{question}' with similarity {similarity}")
                
            # Sort by similarity (descending)
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            
            # Get top 5 results
            top_results = similarities[:5]
        
        if not top_results:
            logger.info(f"No similar answers found for query: '{query}'")
            return None

        # Format context for Gemini
        context = "Here are some relevant FAQ entries:\n\n"
        for i, result in enumerate(top_results, 1):
            context += f"{i}. Q: {result['question']}\nA: {result['answer']}\n\n"

        # Generate response using Gemini with the detailed prompt
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f"""
# Futurense Helpdesk AI Assistant Prompt

**You are a virtual support agent for Futurense's Ticketing System. Your role is to provide professional, courteous, and efficient responses to student queries using only the provided Knowledge Base context.**

## Input Parameters:
🔹 **Student Query**: {query}  
🔹 **Top 5 Similar FAQ Entries**: {context}

## Core Response Logic:

### 1. **Relevance Assessment (Critical)**
**MANDATORY FIRST STEP**: Before crafting any response, you MUST determine if the provided FAQ entries are actually relevant to the student's query.

**Strict Relevance Criteria**:
- The FAQ content must DIRECTLY address the specific issue mentioned in the student's query
- Keywords alone are NOT sufficient - the context and intent must match
- If the query is vague, unclear, or contains minimal information (e.g., single words, random text), treat as NO MATCH
- If you have ANY doubt about relevance, default to NO MATCH response

**Examples of IRRELEVANT matches to avoid**:
- Query: "check button" → FAQ about video completion buttons (NOT relevant - too vague)
- Query: "problem" → FAQ about specific technical issues (NOT relevant - too generic)
- Query: "help" → Any random FAQ entry (NOT relevant - no specific context)

**Decision Process**:
- **If FAQ directly solves the student's specific problem**: Use the FAQ information
- **If FAQ seems related but doesn't match the specific query**: Proceed to "No Match Response"
- **If query is unclear/vague**: Always use "No Match Response"

### 2. **Context-Specific Answering**
When FAQ entries ARE relevant:
- Use the specific information from the matching FAQ entry
- Provide a clear, concise response that directly addresses the query
- Maintain professional tone throughout
- Do NOT mention the Knowledge Base or FAQ source

### 3. **No Match Response (Default for Unclear Queries)**
When NO FAQ entries are relevant OR when the student query is vague/unclear:
```
"Thank you for reaching out. We understand your concern and our team will review this matter on priority to provide you with a detailed response as soon as possible.

Regards,  
Futurense Support Team"
```

**Use this response for**:
- Vague queries (single words, unclear descriptions)
- When FAQ entries don't match the specific issue
- Random or test-like inputs
- When in doubt about relevance

### 4. **Special Handling Instructions**

#### **Technical Issues & System Glitches**:
- **Always acknowledge both**: the immediate workaround AND internal investigation
- **Template Response**:
```
"Thank you for reaching out regarding [technical issue]. We understand the difficulty you're experiencing.

[If applicable: Provide immediate workaround/alternative steps]

Additionally, our team will look into this and will check if the issue is found to provide you with an appropriate solution.

If you continue to face difficulties, please reply to this ticket.

Regards,  
Futurense Support Team"
```

#### **Assignment/Quiz Extensions**:
- Acknowledge the request professionally
- Inform that formal approval is required from course faculty and Program Director
- Do NOT approve or deny requests yourself

#### **Technical Query Restrictions**:
- NEVER refer students to University faculty or Program Directors for technical issues
- Handle technical matters internally within Futurense team
- Escalate technical issues to internal teams only

### 5. **Response Quality Standards**
- **Tone**: Professional, empathetic, and supportive
- **Grammar**: Proper sentence structure and punctuation
- **Clarity**: Direct and concise communication
- **Avoid**: Casual expressions, assumptions, or invented information

### 6. **Preferred Professional Phrases**
- "Thank you for reaching out regarding..."
- "We understand the issue you're experiencing..."
- "Our team will investigate this matter and respond at the earliest..."
- "Please note that..."
- "If you need further assistance, feel free to reply to this ticket..."

## Key Behavioral Rules:
✅ **DO:**
- Assess FAQ relevance before responding
- Acknowledge both immediate solutions AND internal investigation for technical issues
- Maintain professional communication standards
- Use only provided KB context when relevant

❌ **DON'T:**
- **NEVER force-fit FAQ information to vague or irrelevant queries**
- Use irrelevant FAQ information just to provide an answer
- Match queries based on keywords alone without context
- Respond to unclear/vague queries with specific FAQ content
- Mention Knowledge Base or FAQ sources
- Invent information not in the provided context
- Direct technical issues to university personnel
- Approve/deny extension requests independently

## Response Template Structure:
```
"Thank you for reaching out regarding [issue summary].

[Main response based on relevant FAQ OR no-match acknowledgment]

[For technical issues: Include both solution steps AND internal investigation note]

If you need further assistance, feel free to reply to this ticket.

Regards,  
Futurense Support Team"
```

**Remember**: 
- **RELEVANCE IS MANDATORY**: Only use FAQ information if it directly addresses the specific query
- For vague queries like "check button" or random text, always use the "No Match Response"
- Quality over quantity - a professional "we'll look into this" response is better than using irrelevant FAQ information
- **When in doubt, default to "No Match Response"**
        """

        response = model.generate_content(prompt)
        return response.text

    except Exception as e:
        logger.error(f"Error finding similar answer: {str(e)}")
        return None


def get_all_faqs() -> List[Dict[str, str]]:
    """Get all FAQs"""
    try:
        if not _collection:
            logger.error("ChromaDB not initialized")
            return []

        results = _collection.get()
        if results and results['metadatas']:
            return [
                {"question": doc, "answer": meta["answer"]}
                for doc, meta in zip(results['documents'], results['metadatas'])
            ]
        return []

    except Exception as e:
        logger.error(f"Error getting all FAQs: {str(e)}")
        return []


# ============== Batch-wise FAQ Functions ==============

def load_faq_data_from_file(batch_id: int, file_content: bytes, filename: str) -> Dict:
    """Load FAQ data from uploaded file (CSV or Excel) and create embeddings for a specific batch"""
    global _batch_faq_data, _batch_collections
    
    try:
        # Read file based on extension
        if filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(file_content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(BytesIO(file_content))
        else:
            raise ValueError("File must be CSV or Excel format (.csv, .xlsx, .xls)")
        
        logger.info(f"Loaded {len(df)} FAQs from uploaded file for batch {batch_id}")

        # Validate columns - support both 'Question'/'Answer' and 'Questions'/'Answers'
        question_col = None
        answer_col = None
        
        for col in df.columns:
            if col.lower() in ['question', 'questions']:
                question_col = col
            if col.lower() in ['answer', 'answers']:
                answer_col = col
        
        if not question_col or not answer_col:
            raise ValueError("File must have 'Questions' and 'Answers' columns (or 'Question' and 'Answer')")

        # Clean data
        df = df.dropna(subset=[question_col, answer_col])

        # Get questions and answers
        questions = df[question_col].tolist()
        answers = df[answer_col].tolist()

        if not questions:
            raise ValueError("No valid questions found in file")

        logger.info(f"Processing {len(questions)} valid FAQ entries for batch {batch_id}")

        # Delete existing collection if it exists
        collection_name = get_batch_collection_name(batch_id)
        try:
            if batch_id in _batch_collections:
                _client.delete_collection(name=collection_name)
                logger.info(f"Deleted existing collection for batch {batch_id}")
        except Exception as e:
            logger.warning(f"Could not delete existing collection: {str(e)}")

        # Create new collection for the batch
        collection = _client.create_collection(name=collection_name)
        _batch_collections[batch_id] = collection
        logger.info(f"Created new FAQ collection for batch {batch_id}")

        # Generate embeddings for questions
        logger.info(f"Generating embeddings for {len(questions)} questions...")
        embeddings = generate_embeddings(questions)
        
        # Store FAQ data in memory for similarity search
        _batch_faq_data[batch_id] = [
            {
                "question": str(question),
                "answer": str(answer),
                "id": str(i)
            }
            for i, (question, answer) in enumerate(zip(questions, answers))
        ]

        # Add to collection with embeddings
        successful_count = 0
        for i, (question, answer, embedding) in enumerate(zip(questions, answers, embeddings)):
            if embedding:  # Only add if embedding was successfully generated
                collection.add(
                    documents=[question],
                    embeddings=[embedding],
                    metadatas=[{
                        "answer": str(answer),
                        "source": "upload",
                        "question": str(question)
                    }],
                    ids=[str(i)]
                )
                successful_count += 1

        logger.info(f"FAQ data loaded successfully with {successful_count} embeddings for batch {batch_id}")
        
        return {
            "success": True,
            "total_rows": len(df),
            "processed_rows": successful_count,
            "message": f"Successfully loaded {successful_count} FAQ entries for the batch"
        }

    except Exception as e:
        logger.error(f"Failed to load FAQ data for batch {batch_id}: {str(e)}", exc_info=True)
        raise Exception(f"Failed to load FAQ data: {str(e)}")


def load_batch_faq_to_memory(batch_id: int):
    """Load FAQ data from existing batch collection to memory"""
    global _batch_faq_data
    
    try:
        collection = _batch_collections.get(batch_id)
        if not collection:
            logger.warning(f"No collection found for batch {batch_id}")
            return
            
        # Get all FAQs from collection
        all_faqs = collection.get()
        
        if not all_faqs['metadatas']:
            logger.warning(f"No FAQ data found in collection for batch {batch_id}")
            return
            
        # Store FAQ data in memory for similarity search
        _batch_faq_data[batch_id] = [
            {
                "question": str(question),
                "answer": str(metadata["answer"]),
                "id": str(id)
            }
            for question, metadata, id in zip(all_faqs['documents'], all_faqs['metadatas'], all_faqs['ids'])
        ]
        
        logger.info(f"Loaded {len(_batch_faq_data[batch_id])} existing FAQs into memory for batch {batch_id}")
        
    except Exception as e:
        logger.error(f"Failed to load FAQ data to memory for batch {batch_id}: {str(e)}", exc_info=True)


def find_similar_answer_for_batch(query: str, batch_id: int, threshold: float = 0.5) -> str:
    """Find most similar answer for a query using embeddings and text similarity for a specific batch"""
    try:
        # Get the collection for the batch
        collection = _batch_collections.get(batch_id)
        
        if not collection:
            logger.warning(f"No FAQ collection found for batch {batch_id}")
            return None

        # First try using embeddings for semantic search
        top_results = []
        try:
            # Generate embedding for query
            query_embedding = genai.embed_content(
                model="gemini-embedding-001",
                content=query
            )
            
            # Search using embedding
            results = collection.query(
                query_embeddings=[query_embedding["embedding"]],
                n_results=5
            )
            
            if results and results['metadatas'] and len(results['metadatas'][0]) > 0:
                # Format results into top_results list
                for question, metadata in zip(results['documents'][0], results['metadatas'][0]):
                    top_results.append({
                        'question': question,
                        'answer': metadata['answer']
                    })
                logger.info(f"Found {len(top_results)} results using embedding search for batch {batch_id}")
                
        except Exception as e:
            logger.warning(f"Embedding search failed, falling back to text similarity: {str(e)}")
        
        # Fall back to text similarity if embedding search fails or returns no results
        if not top_results:
            logger.info(f"Embedding search returned no results for batch {batch_id}, falling back to text similarity")
            
            # Get all FAQs
            all_faqs = collection.get()
            
            if not all_faqs['metadatas']:
                return None
                
            # Adjust threshold based on query length
            query_word_count = len(query.strip().split())
            adjusted_threshold = threshold
            if query_word_count <= 2:
                adjusted_threshold = 0.7
            elif query_word_count <= 5:
                adjusted_threshold = 0.5

            # Calculate similarity for each question
            similarities = []
            for i, question in enumerate(all_faqs['documents']):
                similarity = calculate_similarity(query, question)
                if similarity >= adjusted_threshold:
                    similarities.append({
                        'index': i,
                        'similarity': similarity,
                        'question': all_faqs['metadatas'][i]['question'],
                        'answer': all_faqs['metadatas'][i]['answer']
                    })
                    
            # Sort by similarity (descending)
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            
            # Get top 5 results
            top_results = similarities[:5]
        
        if not top_results:
            logger.info(f"No similar answers found for query: '{query}' in batch {batch_id}")
            return None

        # Format context for Gemini
        context = "Here are some relevant FAQ entries:\n\n"
        for i, result in enumerate(top_results, 1):
            context += f"{i}. Q: {result['question']}\nA: {result['answer']}\n\n"

        # Generate response using Gemini with the detailed prompt
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f"""
# Futurense Helpdesk AI Assistant Prompt

**You are a virtual support agent for Futurense's Ticketing System. Your role is to provide professional, courteous, and efficient responses to student queries using only the provided Knowledge Base context.**

## Input Parameters:
🔹 **Student Query**: {query}  
🔹 **Top 5 Similar FAQ Entries**: {context}

## Core Response Logic:

### 1. **Relevance Assessment (Critical)**
**MANDATORY FIRST STEP**: Before crafting any response, you MUST determine if the provided FAQ entries are actually relevant to the student's query.

**Strict Relevance Criteria**:
- The FAQ content must DIRECTLY address the specific issue mentioned in the student's query
- Keywords alone are NOT sufficient - the context and intent must match
- If the query is vague, unclear, or contains minimal information (e.g., single words, random text), treat as NO MATCH
- If you have ANY doubt about relevance, default to NO MATCH response

**Decision Process**:
- **If FAQ directly solves the student's specific problem**: Use the FAQ information
- **If FAQ seems related but doesn't match the specific query**: Proceed to "No Match Response"
- **If query is unclear/vague**: Always use "No Match Response"

### 2. **Context-Specific Answering**
When FAQ entries ARE relevant:
- Use the specific information from the matching FAQ entry
- Provide a clear, concise response that directly addresses the query
- Maintain professional tone throughout
- Do NOT mention the Knowledge Base or FAQ source

### 3. **No Match Response (Default for Unclear Queries)**
When NO FAQ entries are relevant OR when the student query is vague/unclear:
```
"Thank you for reaching out. We understand your concern and our team will review this matter on priority to provide you with a detailed response as soon as possible.

Regards,  
Futurense Support Team"
```

### 4. **Response Quality Standards**
- **Tone**: Professional, empathetic, and supportive
- **Grammar**: Proper sentence structure and punctuation
- **Clarity**: Direct and concise communication
- **Avoid**: Casual expressions, assumptions, or invented information

## Key Behavioral Rules:
✅ **DO:**
- Assess FAQ relevance before responding
- Maintain professional communication standards
- Use only provided KB context when relevant

❌ **DON'T:**
- **NEVER force-fit FAQ information to vague or irrelevant queries**
- Use irrelevant FAQ information just to provide an answer
- Match queries based on keywords alone without context
- Mention Knowledge Base or FAQ sources
- Invent information not in the provided context

## Response Template Structure:
```
"Thank you for reaching out regarding [issue summary].

[Main response based on relevant FAQ OR no-match acknowledgment]

If you need further assistance, feel free to reply to this ticket.

Regards,  
Futurense Support Team"
```

**Remember**: 
- **RELEVANCE IS MANDATORY**: Only use FAQ information if it directly addresses the specific query
- **When in doubt, default to "No Match Response"**
        """

        response = model.generate_content(prompt)
        return response.text

    except Exception as e:
        logger.error(f"Error finding similar answer for batch {batch_id}: {str(e)}")
        return None


def get_all_batch_faqs(batch_id: int) -> List[Dict[str, str]]:
    """Get all FAQs for a specific batch"""
    try:
        collection = _batch_collections.get(batch_id)
        
        if not collection:
            logger.warning(f"No FAQ collection found for batch {batch_id}")
            return []

        results = collection.get()
        if results and results['metadatas']:
            return [
                {"question": doc, "answer": meta["answer"]}
                for doc, meta in zip(results['documents'], results['metadatas'])
            ]
        return []

    except Exception as e:
        logger.error(f"Error getting all FAQs for batch {batch_id}: {str(e)}")
        return []


def get_batch_faq_count(batch_id: int) -> int:
    """Get the count of FAQs for a specific batch"""
    try:
        collection = _batch_collections.get(batch_id)
        if collection:
            return collection.count()
        return 0
    except Exception as e:
        logger.error(f"Error getting FAQ count for batch {batch_id}: {str(e)}")
        return 0


def has_batch_faq_collection(batch_id: int) -> bool:
    """Check if a batch has an FAQ collection"""
    return batch_id in _batch_collections


def delete_batch_collection(batch_id: int) -> bool:
    """Delete the FAQ collection for a specific batch"""
    global _batch_collections, _batch_faq_data
    try:
        collection_name = get_batch_collection_name(batch_id)
        if batch_id in _batch_collections:
            _client.delete_collection(name=collection_name)
            del _batch_collections[batch_id]
            if batch_id in _batch_faq_data:
                del _batch_faq_data[batch_id]
            logger.info(f"Deleted FAQ collection for batch {batch_id}")
            return True
        return False
    except Exception as e:
        logger.error(f"Error deleting FAQ collection for batch {batch_id}: {str(e)}")
        return False


def initialize_batch_collections():
    """Initialize all existing batch collections on startup"""
    global _batch_collections
    try:
        existing_collections = _client.list_collections()
        for col in existing_collections:
            if col.name.startswith("faq_collection_batch_"):
                batch_id = int(col.name.replace("faq_collection_batch_", ""))
                _batch_collections[batch_id] = col
                load_batch_faq_to_memory(batch_id)
                logger.info(f"Loaded existing FAQ collection for batch {batch_id}")
    except Exception as e:
        logger.warning(f"Error loading existing batch collections: {str(e)}")


# Initialize ChromaDB when module is imported
try:
    initialize_chromadb()
except Exception as e:
    logger.error(f"Failed to initialize ChromaDB on module import: {str(e)}")
