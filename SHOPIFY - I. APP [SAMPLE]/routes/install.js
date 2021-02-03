/**
 * ./routes/install.js
 */
const config = require('../config');

const express = require('express');
const Shopify = require('shopify-node-api');
const ShopifyAPI = require('shopify-node-api');
const mongoose = require('mongoose');

const MongoShop = mongoose.model('Shop');
const Shop = require('../models/Shop');
const generateNonce = require('../helpers').generateNonce;

const router = express.Router();

router.get('/', (req, res) => {

  const shopName = req.query.shop + '.myshopify.com';
  const nonce = generateNonce();
  const query = Shop.findOne({ shopify_domain: shopName }).exec();
  const shopAPI = new Shopify({
    shop: shopName,
    shopify_api_key: config.SHOPIFY_API_KEY,
    shopify_shared_secret: config.SHOPIFY_SHARED_SECRET,
    shopify_scope: config.APP_SCOPE,
    nonce,
    redirect_uri: `${config.APP_URI}/install/callback`,
  });
  const redirectURI = shopAPI.buildAuthURL();

  // HIDDEN CODE
});

router.get('/callback', (req, res) => {
  const params = req.query;
  const shopName = params.shop
  const query = Shop.findOne({ shopify_domain: shopName }).exec();
  query.then((result) => {
    const shop = result;
    const shopAPI = new Shopify({
      shop: shopName,
      shopify_api_key: config.SHOPIFY_API_KEY,
      shopify_shared_secret: config.SHOPIFY_SHARED_SECRET,
      nonce: shop.nonce,
    });

    shopAPI.exchange_temporary_token(params, async (error, data) => {
      if (error) {
        res.redirect('/error');
      }
      shop.accessToken = data.access_token;
      shop.isActive = true;
      shop.save((saveError) => {
        if (saveError) {
          res.redirect('/error');
        }
        if (config.APP_STORE_NAME) {
          res.redirect(`https://${shop.shopify_domain}/admin/apps/${config.APP_STORE_NAME}`);
        } else {
          res.redirect(`https://${shop.shopify_domain}/admin/apps`);
        }
      });

      const Shop = new ShopifyAPI({
        shop: shop.shopify_domain,
        shopify_api_key: config.SHOPIFY_API_KEY,
        shopify_shared_secret: config.SHOPIFY_SHARED_SECRET,
        access_token: shop.accessToken,
      });

      // REGISTER PRODUCT WEBHOOK
      // Topics allowed: app/uninstalled, carts/create, carts/update, checkouts/create, checkouts/delete, checkouts/update, checkouts/paid, collections/create, collections/delete, collections/update, order_transactions/create, orders/cancelled, orders/create, orders/delete, orders/fulfilled, orders/paid, orders/partially_fulfilled, orders/updated, products/create, products/delete, products/update, refunds/create, shop/update, tender_transactions/create, app_purchase_one_time/update, app_subscriptions/update'
      const topic = 'products/update'
      const address= `${config.APP_URI}/webhook/products/update?shop=${shopName}`
      const webhookPayload = {
        webhook: {
          topic,
          address,
          format: 'json',
        },
      };
      Shop.post(`/admin/api/${config.API_VERSION}/webhooks.json`, webhookPayload, (err, response, headers) => {
        if (err) { console.log(`== WEBHOOK ${topic} WAS NOT REGISTERED == `, shopName, 'ERROR: ', err)
        } else { console.log(`== WEBHOOK ${topic} WAS SUCCESSFULLY REGISTERED == `, shopName, 'Response: ', response)}
      })
      
      // REGISTER SCRIPT TAG
      const scriptTagPayload = {
        script_tag: {
          event: 'onload',
          src: `${config.APP_URI}/js/boom-ig-storefront${process.env.NODE_ENV === 'PRODUCTION' ? '_prod' : ''}.js`,
          display_scope: 'all',
        },
      };
      Shop.post(`/admin/api/${config.API_VERSION}/script_tags.json`, scriptTagPayload, (err, response, headers) => {
        if (err) { console.log('== SCRIPT WAS NOT REGISTERED == ', shopName, 'ERROR: ', err)
        } else { console.log('== SCRIPT WAS SUCCESSFULLY REGISTERED == ', shopName, 'Response: ', response)}
      })

    });
  });
});

module.exports = router;