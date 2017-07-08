const express = require('express');
const server = express();

module.exports = () => {
  server.set('port', process.env.PORT || 5000);
  server.use(express.static(`${__dirname}/public`));

  server.get('/', (request, response) => {
    response.send('This is node.js app for KZT Course twitter account.');
  });

  server.listen(server.get('port'), () => {
    console.log(`Node app is running at localhost:${server.get('port')}`);
  });
};
