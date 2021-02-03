const config = require('../config');
const {google} = require('googleapis');
const axios = require('axios');

const mongoose = require('mongoose');
const MongoShop = mongoose.model('Shop');

module.exports = {
    orderPagesArrayGenerator(count, limit) {
        const length = Math.floor( count / limit) + (count % limit == 0 ? 0 : 1);
        const pages = [...(new Array(length - 1 + 1)).fill(undefined).map((_, i) => i + 1)]
        return pages
    },
    parseShopifyLinkHeader (header_link) {
      let next = ''
      if (header_link === undefined) return ''
      header_link.split(', ').map( link => {
          const parts = link.split('; ');
          if (parts.length == 2) { 
              if (parts[1].split('=')[1].split('"').join('') === 'next') {
                  next = parts[0].split('&')[2].split('=')[1].split('>').join('');
              }
          }
      })
      return next;
    },
    phoneTransform(invalidPhone) {
        let validPhoneString = ''
        const firstTwoCharacter = invalidPhone[0] + invalidPhone[1]
        if (invalidPhone[0] !== '+') {
            if (firstTwoCharacter === '36') { 
                validPhoneString = '+' + invalidPhone
            } else if (firstTwoCharacter === '67' || firstTwoCharacter === '62' || firstTwoCharacter === '63') {
                validPhoneString = '+3' + invalidPhone
            } else if (firstTwoCharacter === '70' || firstTwoCharacter === '20' || firstTwoCharacter === '30' || firstTwoCharacter === '31') {
                validPhoneString = '+36' + invalidPhone
            } else if (firstTwoCharacter === '06') {
                validPhoneString = '+3' + invalidPhone.substr(1, invalidPhone.length)
            } else if (firstTwoCharacter === '00') {
                validPhoneString = '+' + invalidPhone.substr(2, invalidPhone.length)
            }
        } else {
            validPhoneString = invalidPhone;
        }
        return validPhoneString.replace(/[\s/]/g, '');
    },
    convertToDateString(monthOrDay) {
        // HIDDEN CODE
    },
    googleDriveAuthorization(callback) {
        // HIDDEN CODE
    },
    googleDriveListFiles(auth) {
        // HIDDEN CODE
    },
    replaceFoxpostPlaceNameWithId(placeIds, placeName) {
        let result =  placeIds.filter( place => place.name == placeName)
        if (result.length === 1) return result[0].placeId
        else return 'Csomagpont nem talalhato!'
    },
    genereateFoxpostProducts(lineItems, foxpostProductId) {
        // HIDDEN CODE
    },
    async getPlacesV3(isJustPlaceId) {
        try {
            const response = await axios.get('http://cdn.foxpost.hu/foxpost_terminals_extended_v3.json')
            if (isJustPlaceId) {
                let placeIds = response.data.map( place => {
                    return {
                    placeId: place.place_id,
                    name: place.name
                    }
                })
                return placeIds
            } else {
                return response.data
            }
        } catch (error) {
            return error
        }
    },
    async shopifyTagPut(shopDomain, orderId, newTags) {
        // HIDDEN CODE
    },
    async getCustomer(shopDomain, customerId) {
        const { accessToken } = await MongoShop.findOne({'shopify_domain': shopDomain}, { accessToken: 1})
        const GET_URL = `https://${shopDomain}/admin/api/${config.API_VERSION}/customers/${customerId}.json`

        try {
            const response = await axios.get( GET_URL, { headers: { 'X-Shopify-Access-Token': accessToken}})
            return response.data.customer
        } catch (err) {
            console.log(err)
        }
        
    },
    async updateCustomerTags(shopDomain, customerId, updatedTags) {
        const { accessToken } = await MongoShop.findOne({'shopify_domain': shopDomain}, { accessToken: 1})

        const PUT_URL = `https://${shopDomain}/admin/api/${config.API_VERSION}/customers/${customerId}.json`
        try {
            const updatedCustomer = await axios.put( PUT_URL , 
                { 
                    customer: {
                        id: customerId,
                        tags: updatedTags
                    }
                }, 
                {
                    headers: { 'X-Shopify-Access-Token': accessToken}
                })
            return updatedCustomer.data.customer
        } catch (err) {
            console.log(err)
        }
    },
    transformCountryToCarrierCode(country) {
        // HIDDEN CODE
    },
    transforCurrency(country_code) {
        // HIDDEN CODE
    },
    transforValueToRightCurrency(country_code, valueInRon) {
        // HIDDEN CODE
    }
}