/**
 * ./routes/api.js
 */
const config = require('../config');

const express = require('express');
const axios = require('axios');
const fs = require('fs');

const { 
  getPlacesV3,
  parseShopifyLinkHeader
} = require('../helpers/util')

const { 
  getSpecificOrders,
  transformedOrdersToRequiredForm,
  getMplOrFoxpostSpecificOrders,
  transformFoxpostOrders,
  transformCsomagkuldoOrdersToProductList
} = require('../helpers/mongoQueries')

const mongoose = require('mongoose');
const MongoShop = mongoose.model('Shop');
const MongoOrder = mongoose.model('Order');

const router = express.Router();

// HIDDEN CODE

router.get('/sync-orders', async (req, res, next) => {
  const shopDomain = req.query.shop
  const { accessToken } = await MongoShop.findOne({'shopify_domain': shopDomain}, {accessToken: 1})
  
  async function get_next_orders (accessToken, baseUrl, params) {
    const resp = await axios.get(`${baseUrl}${params}`, { headers: { 'X-Shopify-Access-Token': accessToken} })
    return [parseShopifyLinkHeader(resp.headers.link),resp.data]
  }

  const baseOrderUrl = `https://${shopDomain}/admin/api/${config.API_VERSION}/orders.json?`
  const starterParams = `status=any&limit=${config.ORDER_FETCH_LIMIT}&fields=id,created_at,gateway,total_price,subtotal_price,total_tax,currency,name,order_number,email,line_items,shipping_address,tags,financial_status,fulfillment_status,cancelled_at,note,customer`
  const nextParams = `&limit=${config.ORDER_FETCH_LIMIT}&fields=id,created_at,gateway,total_price,subtotal_price,total_tax,currency,name,order_number,email,line_items,shipping_address,tags,financial_status,fulfillment_status,cancelled_at,note,customer&page_info=`
  // Get first 50 orders and update
  const initialRequest_next = await get_next_orders(accessToken, baseOrderUrl, starterParams)
  bulkMongoUpdate(initialRequest_next[1].orders)
  // If there is 50+ orders 
  if (initialRequest_next[0].length !== 0) {
      let page_info = initialRequest_next[0]
      while (page_info.length != 0) {
          const nextReq = await get_next_orders(accessToken, baseOrderUrl, nextParams+page_info)
          bulkMongoUpdate(nextReq[1].orders)
          if (nextReq.length[0] != 0 ) {
              page_info = nextReq[0]
          } 
      }
  }
  // Orders update - [BULK]
  function bulkMongoUpdate (orders) {
      console.log(`Order sync in progress... (${orders.length})`)
      let mappedBulkOrders = orders.map( order => {
        return {
          updateOne: {
            filter: { id: order.id, shopify_domain: shopDomain},
            update: { $set: {
              id: order.id,
              // HIDDEN CODE
              customer_id: order.customer && order.customer.id || null,
              lineItems: order.line_items.map ( item => {
                return {
                  id: item.id,
                  variant_id: item.variant_id,
                  product_id: item.product_id,
                  name: item.name,
                  quantity: item.quantity
                }
              }),
              shippingAddress: order.shipping_address ? {
                // HIDDEN CODE
              } : {}
            }},
            upsert: true,
            setDefaultsOnInsert: true
          }
        }
      })
      // HIDDEN CODE
      MongoOrder.bulkWrite(mappedBulkOrders).then( result => {
        console.log('BULK RESPONSE: ', Object.keys(result.upsertedIds).length)
      })
  }
  res.json(`All the orders were updated successfully. PCS = ${orderCount.data}`)
})

router.get('/export-xls-products', async (req, res, next) => {
  const shopDomain = req.query.shop
  const dateGte = req.query.date_gte || ''
  const dateLt = req.query.date_lt || ''

  const { foxpostProductId } = await MongoShop.findOne({'shopify_domain': shopDomain}, { foxpostProductId: 1})
  
  // TODO - More specific file name
  const filePathAndName = `./tmp_export/${shopDomain.split('.').join('-')}-orders_products.xls`
  let writeStream = await fs.createWriteStream(filePathAndName)

  writeStream.on('close', function(){
    res.download(filePathAndName, (err) => {
      if (err) throw err;
      fs.unlink(filePathAndName, (err) => {
        if (err) throw err;
        console.log('File was removed! Name: ', filePathAndName)
      })
    })
  })

  const orderIds = req.query.orders ? req.query.orders.split(',') : []

  // Product List - [MAPPING]
  const orders = await getMplOrFoxpostSpecificOrders(shopDomain, foxpostProductId, typeOfExport = 'mpl', dateGte, dateLt, orderIds)
  const transformedOrders = await transformCsomagkuldoOrdersToProductList(orders)
  let joinedOrders = transformedOrders.map( order => {
    const { orderNumber, lineItems, invoice } = order
    const concatenatedString = [orderNumber, lineItems, invoice, ' '].join('\n');
    return concatenatedString
  })
  
  const writeTheseRows = joinedOrders.join('\n')
  await writeStream.write(writeTheseRows);
  await writeStream.close();
})

router.get('/export-xls', async (req, res, next) => {
  const shopDomain = req.query.shop
  const typeOfExport = req.query.type ? req.query.type.toLowerCase() : ''

  const dateGte = req.query.date_gte || ''
  const dateLt = req.query.date_lt || ''

  const { foxpostProductId } = await MongoShop.findOne({'shopify_domain': shopDomain}, { foxpostProductId: 1})
  
  // TODO - More specific file name
  const filePathAndName = `./tmp_export/${shopDomain.split('.').join('-')}-${typeOfExport}-orders.${typeOfExport !== 'mpl' ? 'csv' : 'xls'}`
  let writeStream = await fs.createWriteStream(filePathAndName)

  writeStream.on('close', function(){
    res.download(filePathAndName, (err) => {
      if (err) throw err;
      fs.unlink(filePathAndName, (err) => {
        if (err) throw err;
        console.log('File was removed! Name: ', filePathAndName)
      })
    })
  })

  const orderIds = req.query.orders ? req.query.orders.split(',') : []
  let joinedOrders

  if (typeOfExport === 'mpl') {
    // MPL START
    // HIDDEN CODE
    // MPL END
  } else if (typeOfExport === 'foxpost') {
    // FOXPOST START
    let orders = await getMplOrFoxpostSpecificOrders(shopDomain, foxpostProductId, typeOfExport, dateGte, dateLt, orderIds)
    const placeIds = await getPlacesV3(true)
    const transformedOrders = await transformFoxpostOrders(orders, placeIds, foxpostProductId)

    joinedOrders = transformedOrders.map( order => {
      const { name, email, phone, pickPoint, weight, codPrice, products, refNumber, uniqueCode} = order
      const concatenatedString = [name, phone, email, pickPoint, codPrice, weight, products, refNumber, uniqueCode].join(',');
      return concatenatedString
    })
    // FOXPOST END
  } else if (typeOfExport === 'csomagkuldo') {
    // CSOMAGKULDO START
    // HIDDEN CODE
    // CSOMAGKULDO END
  }

  // COMBINE WITH SPECIFIC HEADERS

  let headerLine
  if (typeOfExport === 'mpl') {
    // HIDDEN CODE
  } else if (typeOfExport === 'foxpost') {
    // HIDDEN CODE
  } else if (typeOfExport === 'csomagkuldo') {
    // HIDDEN CODE
  }

  // CONCATENATE
  if (typeOfExport !== 'csomagkuldo') { 
    joinedOrders.unshift(headerLine) 
  } else {
    joinedOrders.unshift('')
    joinedOrders.unshift('verze 5')
  }
  const writeTheseRows = joinedOrders.join('\n')
  await writeStream.write(writeTheseRows);
  await writeStream.close();
})

router.get('/foxpost-map', async (req, res, next) => {
  const shopDomain = req.query.shop
  const places = await getPlacesV3()
  places.sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
  const { foxpostProductId, isWidgetActive} = await MongoShop.findOne({'shopify_domain': shopDomain}, { foxpostProductId: 1, isWidgetActive: 1})
  await axios.all([
    // HIDDEN CODE
  ]).then( axios.spread( (apiJqueryJs, vueSelectJs, vueSelectCss) => {
    res.render('foxpost/map', {
      title: 'Foxpost map',
      appURI: config.APP_URI,
      foxpostMap: true,
      places,
      isWidgetActive,
      foxpostItemVariant: foxpostProductId,
      // 3rd party libraries
      apiJqueryJs: apiJqueryJs.data,
      vueSelectJs: vueSelectJs.data,
      vueSelectCss: vueSelectCss.data
    })
  }))
});

router.get('/get-orders', async (req, res, next) => {
  const shopDomain = req.query.shop
  const { foxpostProductId } = await MongoShop.findOne({'shopify_domain': shopDomain}, { foxpostProductId: 1})
  
  let orders = await getSpecificOrders(shopDomain)
  const placeIds = await getPlacesV3(true)
  const transformedOrders = await transformedOrdersToRequiredForm(orders, foxpostProductId, placeIds)

  res.json(transformedOrders)
})

router.get('/mark-preparead-order', async (req, res, next) => {
  const shopDomain = req.query.shop
  const orderId = req.query.orderId
  const isPreparead = req.query.isPreparead
  try {
    let result = await MongoOrder.findOneAndUpdate({ id: orderId, shopify_domain: shopDomain }, { $set: { isPreparead }})
    // HIDDEN CODE
  } catch (err) {
    // HIDDEN CODE
  }

  res.json({message: resMessage})
})

router.get('/paid-order', async (req, res, next) => {
  // HIDDEN CODE
  const paidResult = await axios.post( URL_TRANSACTION, 
      { transaction: { currency, amount, kind: 'capture', parent_id: pendingTransactionId} },
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    )
  // HIDDEN CODE
  if(paidResult.data.transaction.id) {
    await MongoOrder.findOneAndUpdate({ id: orderId, shopify_domain: shopDomain }, { $set: { financialStatus: 'paid' }})
    resMessage = `Order with ${orderId} ID was PAID successfully.`
  }

  res.json({message: resMessage})
})

router.get('/fulfill-order', async (req, res, next) => {
  // HIDDEN CODE
  const URL_LOCATION = `https://${shopDomain}/admin/api/${config.API_VERSION}/locations.json`
  const URL_FULFILLMENT_CREATE = `https://${shopDomain}/admin/api/${config.API_VERSION}/orders/${orderId}/fulfillments.json`
  
  const locationResult = await axios.get( URL_LOCATION, { headers: { 'X-Shopify-Access-Token': accessToken }})
  // HIDDEN CODE
  let fulfillmentResult = await axios.post( URL_FULFILLMENT_CREATE, 
    { fulfillment: { location_id, tracking_number: null, notify_customer: true} },
    { headers: { 'X-Shopify-Access-Token': accessToken } }
  )
  // HIDDEN CODE
})

router.post('/add-or-remove-order-tags', async (req, res, next) => {
  // HIDDEN CODE
})

router.post('/modify-note', async (req, res, next) => {
  // HIDDEN CODE
    const PUT_URL = `https://${shopDomain}/admin/api/${config.API_VERSION}/orders/${orderId}.json`
    axios.put( PUT_URL , 
      { 
        order: {
          id: orderId,
          note: newNote
        }
      }, 
      {
        headers: { 'X-Shopify-Access-Token': accessToken}
      }
    ).then( async response => {
      const newNote = response.data.order.note 
      // TODO - ERROR HANDLING
      await MongoOrder.findOneAndUpdate({ id: orderId, shopify_domain: shopDomain }, { $set: { note: newNote }})
      res.json({message: `Order with ${orderId} ID was updated successfully. (NOTE)`, status: 'OK'})
    })
  // HIDDEN CODE
})

router.post('/save-update-or-delete-tag-profiles', async (req, res, next) => {
  // HIDDEN CODE
})

module.exports = router;
