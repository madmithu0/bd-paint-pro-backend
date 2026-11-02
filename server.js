const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');

dotenv.config();
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/mistris', require('./routes/mistriRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/materials', require('./routes/materialRoutes'));
app.use('/api/banners', require('./routes/bannerRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

app.get('/', (req, res) => {
  res.send('BD Paint Pro API is Running...');
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));