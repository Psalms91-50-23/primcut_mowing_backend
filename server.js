// server.js
if (process.env.NODE_ENV !== "production") {
  import('dotenv').then(dotenv => dotenv.config());
}

import app from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('SESSION_SECRET:', process.env.SESSION_SECRET);
  console.log(`Server running on port ${PORT}`);
});