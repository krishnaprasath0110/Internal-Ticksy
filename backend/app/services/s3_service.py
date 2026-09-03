import boto3
from botocore.exceptions import ClientError
import os
from typing import List
import uuid
from fastapi import UploadFile
from app.core.config import settings

class S3Service:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.bucket_name = settings.AWS_S3_BUCKET
        
    async def upload_files(self, files: List[UploadFile] | UploadFile, ticket_id: int, folder: str = 'new') -> List[str]:
        """
        Upload files to S3 bucket with the structure: fut-helpdesk/tickets/{ticket_id}/{folder}/
        folder can be either 'new' for new ticket attachments or 'thread' for thread attachments
        """
        uploaded_files = []
        
        # Ensure that files is always a list, even if it's a single UploadFile
        files_list = files if isinstance(files, list) else [files]

        for file in files_list:
            if file and file.filename:
                try:
                    # Generate unique filename to avoid collisions
                    file_extension = os.path.splitext(file.filename)[1]
                    unique_filename = f"{uuid.uuid4()}{file_extension}"
                    
                    # Construct the S3 key (path)
                    s3_key = f"tickets/{ticket_id}/{folder}/{unique_filename}"
                    
                    # Read file content
                    content = await file.read()
                    
                    # Upload to S3
                    self.s3_client.put_object(
                        Bucket=self.bucket_name,
                        Key=s3_key,
                        Body=content,
                        ContentType=file.content_type
                    )
                    
                    # Generate the file URL as a complete string
                    file_url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
                    uploaded_files.append(file_url)
                    
                except ClientError as e:
                    print(f"Error uploading file {file.filename}: {str(e)}")
                    raise
                finally:
                    await file.seek(0)  # Reset file pointer
                    
        # Return a clean list of complete URLs
        return uploaded_files

s3_service = S3Service()
