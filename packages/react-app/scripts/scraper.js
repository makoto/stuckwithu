const fetch = require("node-fetch");
const C_KEY = 'ckey_125f8d62ef8b4410a92c2787d6c'
const TRYROL_ROLL_URL = 'https://api.tryroll.com/v2/tokens'
const COINS = require('../src/components/coins.json')
const ALL_COINS_FILE = './data/all_coins.json'
const fs = require('fs');
const { map } = require("lodash");
const _ = require('lodash')
var similarity = require( 'compute-cosine-similarity' );

const fetchTokenholders = async (token_address) => {
    let pageNumber = 0
    let has_more = true
    let total_items = []
    let total_count
    while(has_more){
      let url = `https://api.covalenthq.com/v1/1/tokens/${token_address}/token_holders?key=${C_KEY}&page-number=${pageNumber}&page-size=100`
      let data = await fetch(url)
      let {data:{items:items, pagination:pagination}} = await data.json()

      has_more = pagination.has_more
      pageNumber = pagination.page_number + 1
      total_count = pagination.total_count
      let filtered = items.map(i=> {
        return {
          balance:parseInt(i.balance),
          address:i.address
        }
      }).filter(i => i.balance > 0 )
      total_items = [...total_items, ...filtered
      ]
    }
    console.log('***total_items', total_items.length, total_count)    
    return total_items
}

const getOrFetch = async(cacheFile, fetchFunc, arg1) => {
  if(fs.existsSync(cacheFile)){
    return JSON.parse(fs.readFileSync(cacheFile))
  } else{
    let data = await fetchFunc(arg1)
    fs.writeFileSync(cacheFile, JSON.stringify(data))
    return data
  }
}

const getAllCoins = async() => {
  return getOrFetch(ALL_COINS_FILE, fetchAllCoins)
}

const getTokenholders = async(tokenAddress) => {
  return getOrFetch(`./data/coins/${tokenAddress}.json`, fetchTokenholders, tokenAddress)
}

const fetchAllCoins = async() => {
  let items = await (await fetch(TRYROL_ROLL_URL)).json()
  let all_coins = [
    ...items.map(c => {
      return {
        symbol:c.symbol,
        token_address:c.contractAddress,
        decimals:c.decimals,
        image:c.logo
      }
    }),
    ...COINS.map(c => {
      return {
        symbol:c.symbol,
        token_address:c.contractAddress,
        decimals:c.decimals,
        image:c.logo
      }
    })
  ]
  return all_coins
}

const main = async() => {
  all_coins = await getAllCoins()
  let stats = []
  let addresses = {}
  for (let i = 0; i < all_coins.length; i++) {
  // for (let i = 0; i < 10; i++) {
    all_coins[i]
    let coin = all_coins[i]
    // console.log('Fetching', {i, symbol:coin.symbol})
    let items = await getTokenholders(coin.token_address)
    // console.log(`Found ${items.length} token holders`)
    items.map(i => {
      if(!addresses[i.address]){
        addresses[i.address] = {}
      }
      addresses[i.address][coin.symbol] = i.balance
    })
    stats.push(
      { 
        symbol:coin.symbol,
        items,
        numTokenHolders:items.length
      }
    )
  }
  let sortedCoins = _.sortBy(stats, 'numTokenHolders').reverse()
  console.log({addressLength:Object.keys(addresses).length, coinLength:all_coins.length})
  console.log({sortedCoins:sortedCoins.slice(0, 10).map(s => [s.symbol, s.numTokenHolders].join(','))})
  // console.log({addresses})
  fs.writeFileSync('./data/tokenranking.csv', sortedCoins.map(s => [s.symbol, s.numTokenHolders].join(',')).join('\n'))
  let addressesArray = Object.keys(addresses).map((a) => {
    let value = addresses[a]
    return {
      address: a,
      coinLength:Object.keys(value).length
    }
  })
  let sortedArray = _.sortBy(addressesArray, 'coinLength').reverse()
  console.log({stats:sortedArray.slice(0,10).map(c => [c.address, c.coinLength].join(','))})
  fs.writeFileSync('./data/addressranking.csv', sortedArray.map(s => [s.address, s.coinLength].join(',')).join('\n'))
  // let matrix = sortedCoins.slice(0,10).map(c => {
  //   let i = sortedArray.slice(0,10).map(a => {
  let matrix = sortedCoins.map(c => {
    let i = sortedArray.map(a => {
    let symbol = c.symbol
      let address = a.address 
      // return addresses[address][symbol] ? 1 : 0
      return addresses[address][symbol] || 0
    })
    return [c.symbol, i]
  })
  // console.log({matrix})
  let similarities = []
  for ( var i = 0; i < matrix.length; i++ ) {
      let x, y, s, similars=[]
      xName = matrix[i][0]
      x = matrix[i][1]
      for ( var j = 0; j < matrix.length; j++ ) {
        yName = matrix[j][0]
        y = matrix[j][1]
        s = similarity( x, y );
        // if(xName === 'WHALE'){
        //   console.log(y.join(','))
        //   console.log(`similarity between ${xName} and ${yName} is ${s}`)  
        // }
        similars.push({
          name:yName,
          score: s ? s.toFixed(3) : 0
        })
      }
      let similarNames = _.orderBy(similars, 'score')
        .filter(s => (s.name !==xName && !!s.score && s.score > 0)).reverse().slice(0,5)
      similarities.push({
        name:xName,
        similars:similarNames.map(a => [a.name,a.score].join(':')).join(',')
      })
  }
  similarities.map(s => {
    let ss = stats.filter(st => st.symbol === s.name)[0]
    console.log(`${s.name} => ${ss.numTokenHolders} holders ${s.similars}`)})
}

main()