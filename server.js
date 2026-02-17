// Only load dotenv in development
console.log("Railway env variables:", process.env);
if (process.env.NODE_ENV !== "production") {
  import('dotenv').then(dotenv => dotenv.config());
}

import app from './app.js';

const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_HAPPY_LAWNS) {
  console.error("❌ FRONTEND_HAPPY_LAWNS is not defined in production!");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});