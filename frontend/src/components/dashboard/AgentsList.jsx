import React from 'react';
import { 
  Typography, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemAvatar, 
  Avatar,
  Box,
  Divider,
  Chip,
  Fade,
  InputBase,
  Paper,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import { 
  Search as SearchIcon, 
  PersonOutline,
  FilterList
} from '@mui/icons-material';
import { useState } from 'react';

const AgentsList = ({ agents, selectedAgent, onAgentSelect }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter agents based on search term
  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    agent.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      maxHeight: '100%' 
    }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Agents
      </Typography>
      
      {/* Search Box */}
      <Paper
        elevation={0}
        sx={{
          p: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          mb: 2,
          border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 1,
          bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <IconButton sx={{ p: '10px' }} aria-label="search">
          <SearchIcon fontSize="small" />
        </IconButton>
        <InputBase
          sx={{ ml: 1, flex: 1 }}
          placeholder="Search agents"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Tooltip title="Filter agents">
          <IconButton 
            sx={{ p: '10px' }} 
            aria-label="filter"
            onClick={() => setShowFilters(!showFilters)}
            color={showFilters ? "primary" : "default"}
          >
            <FilterList fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>
      
      {/* Filter Options - Can be expanded in the future */}
      {showFilters && (
        <Fade in={showFilters}>
          <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip 
              label="All" 
              color="primary" 
              variant="filled" 
              size="small" 
              onClick={() => {}} 
            />
            <Chip 
              label="Active" 
              variant="outlined" 
              size="small" 
              onClick={() => {}} 
            />
            <Chip 
              label="Inactive" 
              variant="outlined" 
              size="small" 
              onClick={() => {}} 
            />
          </Box>
        </Fade>
      )}
      
      {/* Agents Count */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {filteredAgents.length} {filteredAgents.length === 1 ? 'agent' : 'agents'} found
        </Typography>
        {selectedAgent && (
          <Typography variant="caption" color="primary" sx={{ cursor: 'pointer' }} onClick={() => onAgentSelect(null)}>
            Clear selection
          </Typography>
        )}
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {/* Agents List Container - Fixed height with scrolling */}
      <Box 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '400px', // Fixed height for scrolling
          maxHeight: '400px',
          overflow: 'hidden',
          border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}`,
          borderRadius: 1,
          boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.02)'
        }}
      >
        {/* Scrollable List */}
        <List 
          sx={{ 
            overflowY: 'auto',
            height: '100%',
            width: '100%',
            p: 0,
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f1f1',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#888',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.3)' : '#555',
            },
          }}
        >
          {filteredAgents.length > 0 ? (
            filteredAgents.map((agent) => (
              <Fade key={agent.id} in={true} style={{ transitionDelay: '50ms' }}>
                <ListItem
                  button
                  onClick={() => onAgentSelect(agent)}
                  selected={selectedAgent?.id === agent.id}
                  sx={{
                    borderBottom: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}`,
                    transition: 'all 0.2s ease-in-out',
                    '&.Mui-selected': {
                      backgroundColor: theme => theme.palette.mode === 'dark' 
                        ? 'rgba(99, 102, 241, 0.15)' 
                        : 'rgba(99, 102, 241, 0.1)',
                      '&:hover': {
                        backgroundColor: theme => theme.palette.mode === 'dark' 
                          ? 'rgba(99, 102, 241, 0.2)' 
                          : 'rgba(99, 102, 241, 0.15)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme => theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.05)' 
                        : 'rgba(0, 0, 0, 0.04)',
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar 
                      sx={{ 
                        bgcolor: selectedAgent?.id === agent.id 
                          ? 'primary.main' 
                          : isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                        color: selectedAgent?.id === agent.id 
                          ? 'white' 
                          : 'text.primary',
                      }}
                    >
                      {agent.name ? agent.name[0].toUpperCase() : <PersonOutline />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={agent.name}
                    primaryTypographyProps={{
                      style: {
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: selectedAgent?.id === agent.id ? 600 : 400,
                      },
                    }}
                    secondary={agent.email}
                    secondaryTypographyProps={{
                      style: {
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      },
                    }}
                  />
                </ListItem>
              </Fade>
            ))
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <PersonOutline sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">
                {searchTerm ? 'No agents match your search' : 'No agents found'}
              </Typography>
            </Box>
          )}
        </List>
      </Box>
    </Box>
  );
};

export default AgentsList;
