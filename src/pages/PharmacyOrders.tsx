import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PharmacyOrders = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to pickup orders by default
    navigate('/pharmacy-pickup-orders');
  }, [navigate]);

  return null;
};

export default PharmacyOrders;
