/**
 * ./routes/index.js
 */
const config = require('../config');

const express = require('express');
const axios = require('axios');
const qs = require('querystring');

const router = express.Router();

router.get('/', (req, res, next) => {
  // HIDDEN CODE
});

router.get('/auth/instagram/callback', (req, res, next) => {
  const code = Object.keys(req.query).map((key) => `${key}=${req.query[key]}`).join('&').split('=')[1];
  
  axios.post(
    'https://api.instagram.com/oauth/access_token',
    qs.stringify({
      client_id: config.IG_APP_ID,
      client_secret: config.IG_APP_TOKEN,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${config.APP_URI}/auth/instagram/callback`
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded'}
    }
  ).then((token) => {
    console.log(token.data)
    res.sendStatus(200)
  })
  .catch( err => {
    console.log(err.response.data)
    res.sendStatus(err.response.data.code)
  })
});

router.get('/auth/facebook/callback', async (req, res, next) => {
  // HIDDEN CODE
});

router.get('/error', (req, res) => res.render('error', { message: 'Something went wrong!' }));

module.exports = router;
