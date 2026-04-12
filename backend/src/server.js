const app = require("./app");
const dotenv = require("dotenv");

dotenv.config();

const port = process.env.BACKEND_PORT || process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Backend API listening on http://localhost:${port}`);
});

