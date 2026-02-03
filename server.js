import app from './app.js';
import dotenv from 'dotenv';
dotenv.config();
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log(`Server running on port ${PORT}`);
});