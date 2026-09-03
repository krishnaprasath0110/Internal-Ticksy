import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NewTicketForm from '../../components/tickets/NewTicketForm';
import { ticketService } from '../../services/ticket';
import { useTheme } from '../../context/ThemeContext';

const NewTicketPage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const { isDark } = useTheme();

  const handleSubmit = async (newTicket) => {
    try {
      await ticketService.createTicket(newTicket);
      // After successful ticket creation, navigate back to tickets list
      navigate('/tickets');
    } catch (err) {
      setError(err.message || 'Failed to create ticket');
    }
  };

  return (
    <div className="min-h-screen py-2 sm:py-4 px-0 sm:px-4 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="shadow-sm sm:rounded-lg overflow-hidden">
          <div className="p-4 sm:p-6">
            {error && (
              <div className={`mb-4 p-4 text-sm ${isDark ? 'text-red-300 bg-red-900' : 'text-red-700 bg-red-100'} rounded-lg`}>
                {error}
              </div>
            )}
            <NewTicketForm
              onSubmit={handleSubmit}
              onCancel={() => navigate('/tickets')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewTicketPage;
