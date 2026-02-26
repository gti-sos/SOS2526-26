let cool = require("cool-ascii-faces");

let express = require('express');

const app = express();
app.
app.use("/",express.static("./static"));


app.get('/faces', (req, res) => {
  res.send(`<html><body><h1>TEST  
            </h1></body></html>`);
})


app.listen(process.env.PORT || 3000, () => {
  console.log('Server is running on http://localhost:3000');
});

