// import React, { useState, useEffect } from 'react';
// import { Box, Grid, Card, Typography, Avatar, List, ListItem, ListItemText, ListItemAvatar } from '@mui/material';
// import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// import { ticketService } from '../../services/ticket';
// import { userService } from '../../services/user';

// const StatusCard = ({ title, count, color }) => (
//   <Card sx={{ p: 2, borderLeft: `4px solid ${color}` }}>
//     <Typography variant="subtitle1" color="textSecondary">
//       {title}
//     </Typography>
//     <Typography variant="h4" sx={{ mt: 1 }}>
//       {count}
//     </Typography>
//   </Card>
// );

// const AgentMetrics = ({ agent, tickets }) => {
//   const agentTickets = tickets.filter(t => t.assigned_to?.id === agent.id);
//   const metrics = {
//     open: agentTickets.filter(t => t.status === 'Open').length,
//     inProgress: agentTickets.filter(t => t.status === 'In Progress').length,
//     closed: agentTickets.filter(t => t.status === 'Closed').length,
//     notApplicable: agentTickets.filter(t => t.status === 'Not Applicable').length,
//     delayed: agentTickets.filter(t => t.is_delayed).length,
//   };

//   const chartData = [
//     { name: 'Open', value: metrics.open },
//     { name: 'In Progress', value: metrics.inProgress },
//     { name: 'Closed', value: metrics.closed },
//     { name: 'Not Applicable', value: metrics.notApplicable },
//   ];

//   return (
//     <Box sx={{ mt: 3 }}>
//       <Typography variant="h6" gutterBottom>
//         {agent.name}'s Metrics
//       </Typography>
//       <Grid container spacing={2} sx={{ mb: 3 }}>
//         <Grid item xs={12} md={2}>
//           <StatusCard title="Open" count={metrics.open} color="#ff9800" />
//         </Grid>
//         <Grid item xs={12} md={2}>
//           <StatusCard title="In Progress" count={metrics.inProgress} color="#2196f3" />
//         </Grid>
//         <Grid item xs={12} md={2}>
//           <StatusCard title="Closed" count={metrics.closed} color="#4caf50" />
//         </Grid>
//         <Grid item xs={12} md={2}>
//           <StatusCard title="Not Applicable" count={metrics.notApplicable} color="#9e9e9e" />
//         </Grid>
//         <Grid item xs={12} md={2}>
//           <StatusCard title="Delayed" count={metrics.delayed} color="#f44336" />
//         </Grid>
//       </Grid>
//       <Box sx={{ height: 300 }}>
//         <ResponsiveContainer width="100%" height="100%">
//           <BarChart data={chartData}>
//             <CartesianGrid strokeDasharray="3 3" />
//             <XAxis dataKey="name" />
//             <YAxis />
//             <Tooltip />
//             <Legend />
//             <Bar dataKey="value" fill="#8884d8" />
//           </BarChart>
//         </ResponsiveContainer>
//       </Box>
//     </Box>
//   );
// };

// const ManagerDashboard = () => {
//   const [tickets, setTickets] = useState([]);
//   const [agents, setAgents] = useState([]);
//   const [selectedAgent, setSelectedAgent] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const { user } = useAuth();

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setLoading(true);
//         const [ticketsData, usersData] = await Promise.all([
//           ticketService.getTickets(),
//           (user?.role?.name === 'department-supervisor' 
//             ? userService.getUsers({ role: 'agent', category_id: user?.user_categories?.[0]?.category_id }) 
//             : user?.role?.name === 'department-manager' 
//             ? userService.getUsers({ role: 'agent', department_id: user?.user_departments?.[0]?.department_id }) 
//             : Promise.resolve([])
//           ),
//         ]);

//         setTickets(ticketsData);
//         setAgents(usersData);
//         setError(null);
//       } catch (err) {
//         setError(err.message || 'Failed to fetch data');
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, []);

//   const metrics = {
//     open: tickets.filter(t => t.status === 'Open').length,
//     inProgress: tickets.filter(t => t.status === 'In Progress').length,
//     closed: tickets.filter(t => t.status === 'Closed').length,
//     notApplicable: tickets.filter(t => t.status === 'Not Applicable').length,
//   };

//   if (loading) {
//     return (
//       <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
//         <Typography>Loading...</Typography>
//       </Box>
//     );
//   }

//   if (error) {
//     return (
//       <Box sx={{ p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
//         <Typography color="error">{error}</Typography>
//       </Box>
//     );
//   }

//   return (
//     <Box sx={{ p: 3 }}>
//       <Typography variant="h4" gutterBottom>
//         Manager Dashboard
//       </Typography>

//       {/* Overall Metrics */}
//       <Grid container spacing={3} sx={{ mb: 4 }}>
//         <Grid item xs={12} md={3}>
//           <StatusCard title="Open Tickets" count={metrics.open} color="#ff9800" />
//         </Grid>
//         <Grid item xs={12} md={3}>
//           <StatusCard title="In Progress" count={metrics.inProgress} color="#2196f3" />
//         </Grid>
//         <Grid item xs={12} md={3}>
//           <StatusCard title="Closed" count={metrics.closed} color="#4caf50" />
//         </Grid>
//         <Grid item xs={12} md={3}>
//           <StatusCard title="Not Applicable" count={metrics.notApplicable} color="#9e9e9e" />
//         </Grid>
//       </Grid>

//       {/* Agents List */}
//       <Grid container spacing={3}>
//         <Grid item xs={12} md={3}>
//           <Card sx={{ p: 2 }}>
//             <Typography variant="h6" gutterBottom>
//               Agents
//             </Typography>
//             <List>
//               {agents.map((agent) => (
//                 <ListItem
//                   key={agent.id}
//                   button
//                   onClick={() => setSelectedAgent(agent)}
//                   selected={selectedAgent?.id === agent.id}
//                 >
//                   <ListItemAvatar>
//                     <Avatar>{agent.name[0]}</Avatar>
//                   </ListItemAvatar>
//                   <ListItemText
//                     primary={agent.name}
//                     secondary={agent.email}
//                   />
//                 </ListItem>
//               ))}
//             </List>
//           </Card>
//         </Grid>

//         {/* Agent Metrics */}
//         <Grid item xs={12} md={9}>
//           {selectedAgent ? (
//             <AgentMetrics agent={selectedAgent} tickets={tickets} />
//           ) : (
//             <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
//               <Typography color="textSecondary">Select an agent to view their metrics</Typography>
//             </Box>
//           )}
//         </Grid>
//       </Grid>
//     </Box>
//   );
// };

// export default ManagerDashboard;
