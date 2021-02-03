/**
 * ./helpers/facebook_util.js
 */
const config = require('../config');

const axios = require('axios');

const getFacebookPages = async (access_token, withInstagramPageId) => {
    const getUrl = `https://graph.facebook.com/v6.0/me/accounts?access_token=${access_token}`;
    const facebokPages = await axios.get(getUrl);
    let pages

    if (withInstagramPageId) {
        pages = await facebokPages.data.data.map( async page => {
            return {
                name: page.name,
                access_token: page.access_token,
                facebookPageId: page.id,
                instagramPageId: await this.getInstagramBusinesPageLinkedToFacebookPage(page.access_token, page.id)
            }
        })
    } else {
        pages = facebokPages.data.data.map( page => {
            return {
                name: page.name,
                facebookPageId: page.id
            }
        })
    }
    return pages
};

const getInstagramBusinesPageLinkedToFacebookPage = async (access_token, facebookPageId) => {
    const getUrl = `https://graph.facebook.com/v6.0/${facebookPageId}?fields=instagram_business_account&access_token=${access_token}`
    const instagramPage = await axios.get(getUrl)
    // TODO - [ERROR HANDLING]
    return instagramPage.data.instagram_business_account.id
}

exports.getFacebookPages = getFacebookPages;
exports.getInstagramBusinesPageLinkedToFacebookPage = getInstagramBusinesPageLinkedToFacebookPage;