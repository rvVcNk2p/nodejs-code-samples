/**
 * ./routes/api.js
 */
const config = require('../config');

const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

const MongoShop = mongoose.model('Shop');

const { 
  getFacebookPages
} = require('../helpers/facebook_util')


const router = express.Router();

/**
 * FB related endpoints
 */

router.post('/update-fb-token', async (req, res, next) => {
  const shopDomain = req.query.shop
  const fbAccessToken = req.body.access_token
  const fbAccessTokenExpirationTime = req.body.expiration_time

  MongoShop.findOneAndUpdate({
    shopify_domain: shopDomain
  }, {
    fbAccessToken,
    fbAccessTokenExpirationTime
  }).then( async mongoResponse => {
    const facebookPages = await getFacebookPages(fbAccessToken, false)
    res.json({facebookPages});
  }).catch( err => {
    console.log('== Something went wrong during the updating process.. ==', err)
    res.sendStatus(400)
  })
})

router.get('/get-facebook-pages', async (req, res, next) => {
  const shopDomain = req.query.shop
  const mongoQuery = await MongoShop.findOne({shopify_domain: shopDomain}, {fbAccessToken: 1})

  const facebookPages = await getFacebookPages(mongoQuery.fbAccessToken, true)
  const facebookWithInstagramId = await Promise.all( facebookPages )

  res.json({facebookWithInstagramId})
})

router.get('/get-instagram-posts', async (req, res, next) => {
  const shopDomain = req.query.shop
  const limit = 9
  const mongoQuery = await MongoShop.findOne({shopify_domain: shopDomain}, {fbAccessToken: 1, selectedInstagramAccountId: 1})
  let getIgPostIdsRequest = await axios.get(`https://graph.facebook.com/v6.0/${mongoQuery.selectedInstagramAccountId}/media?access_token=${mongoQuery.fbAccessToken}&limit=${limit}`)
  const igPostIds =getIgPostIdsRequest.data.data 
  let postsPromises = igPostIds.map( async post => {
    return await axios.get(`https://graph.facebook.com/v6.0/${post.id}?fields=id,media_type,media_url,timestamp, comments_count, permalink, like_count, caption&access_token=${mongoQuery.fbAccessToken}`)
  })
  const postsResolvedPromises = await Promise.all(postsPromises)

  let instagramPosts = postsResolvedPromises.map( post => {
    return {
      id: post.data.id,
      permalink: post.data.permalink,
      media_type: post.data.media_type,
      media_url: post.data.media_url,
      timestamp: post.data.timestamp,
      comments_count: post.data.comments_count,
      like_count: post.data.like_count,
      caption: post.data.caption
    }
  })

  res.json({instagramPosts})
})

router.get('/boom-ig-feed', async (req, res, next) => {
  const shopDomain = req.query.shop

  // const { foxpostProductId, isWidgetActive} = await MongoShop.findOne({'shopify_domain': shopDomain}, { foxpostProductId: 1, isWidgetActive: 1})
  
  await axios.all([
    axios.get('https://cdn.shopify.com/s/assets/themes_support/api.jquery-e94e010e92e659b566dbc436fdfe5242764380e00398907a14955ba301a4749f.js'),
    axios.get(`https://606156a9.ngrok.io/api/get-instagram-posts?shop=${shopDomain}`),
    axios.get(`https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment-with-locales.min.js`)
  ]).then( axios.spread( (apiJqueryJs, instagramPosts, moment) => {
    res.render('boom-ig-feed/feed', {
      title: '[BOOM] Ig Feed',
      appURI: config.APP_URI,
      igFeedIsActive: true,
      instagramPosts: instagramPosts.data.instagramPosts,
      marginDistance: 98,
      itemInARow: 3,
      itemInTheColumn: 3,
      // 3rd party libraries
      apiJqueryJs: apiJqueryJs.data,
      moment: moment.data
    })
  }))
})

module.exports = router;
