import React, { useCallback, useEffect, useState } from "react";
import { Contract } from "@ethersproject/contracts";
import { Web3Provider, getDefaultProvider } from "@ethersproject/providers";
import { useQuery } from "@apollo/react-hooks";
import coinData from "./components/coins"
import { Body, Button, Header, Image, Link } from "./components";
import { web3Modal, logoutOfWeb3Modal } from './utils/web3Modal'
import logo from "./logo.png";
import { abis } from "@project/contracts";
import GET_TRANSFERS from "./graphql/subgraph";
import { BackgroundColor } from "chalk";
import SpiderGraph from './SpiderGraph'
import { components } from "react-select";
import CreatableSelect from 'react-select/creatable'
import { ethers } from 'ethers';
import Modal from 'react-modal';

import _ from 'lodash';

const customStyles = {
  option: (provided, state) => ({
    ...provided
  }),
  control: () => ({
    width: 600,
  }),
  singleValue: (provided, state) => {
    const opacity = state.isDisabled ? 0.5 : 1;
    const transition = 'opacity 300ms';
    return { ...provided, opacity, transition };
  }
}

const d3 = require('d3')
const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000'
const BALANCE_CHECKER_ADDRESS = '0xb1f8e55c7f64d203c1400b9d8555d050f94adf39'
const NODE_KEY = '63c463ac9dff4296ac5ac483aa660138'
const C_KEY = 'ckey_125f8d62ef8b4410a92c2787d6c'
function WalletButton({ provider, loadWeb3Modal }) {
  return (
    <Button
      onClick={() => {
        if (!provider) {
          loadWeb3Modal();
        } else {
          logoutOfWeb3Modal();
        }
      }}
    >
      {!provider ? "Connect Wallet" : "Disconnect Wallet"}
    </Button>
  );
}

function App() {
  const { loading, error, data } = useQuery(GET_TRANSFERS);
  const [provider, setProvider] = useState();
  const [networkId, setNetworkId] = useState();
  const [addresses, setAddresses] = useState([]);
  const [otherAddress, setOtherAddress] = useState();
  const [errorMessage, setErrorMessage] = useState();
  const [otherName, setOtherName] = useState();
  const [coins, setCoins] = useState([]);
  const [update, setUpdate] = useState(new Date())
  const [tokenSymbol, setTokenSymbol] = useState()
  const [suggestions, setSuggestions] = useState([])
  const [tokenOptions, setTokenOptions] = useState([])
  const [ethUsdPrice, setEthUsdPrice] = useState()
  const [modalIsOpen,setIsOpen] = useState(false);
  const [tokenDetail, setTokenDetail] = useState({});
  const [tokenHolders, setTokenHolders] = useState({});
  const [spinnerMessage, setSpinnerMessage] = useState();

  const addSampleTokens = async(e) =>{
    e.preventDefault()
    switch(e.target.text) {
      case 'art':
        await handleSearch('SKULL')
        await handleSearch('HOWL')
        await handleSearch('HUE')
        break;
      case 'game':
        await handleSearch('coin')
        await handleSearch('FORCER')
        break;
      case 'media':
        await handleSearch('JOON')
        await handleSearch('CAMI')
        await handleSearch('KARMA')
        await handleSearch('EVAN')
        await handleSearch('JAMM')
        break;
      case 'dao':
        await handleSearch('$pew')
        await handleSearch('PETER')
        await handleSearch('ALEX')
        await handleSearch('RCLE')
        await handleSearch('MAGIC')
        break;
      case 'entertainer':
        await handleSearch('rac')
        await handleSearch('CHERRY')
        await handleSearch('FIRST')
        break;
      case 'vc':
        await handleSearch('jake')
        await handleSearch('AVC')
        await handleSearch('WHALE')
        break;
      case 'defi':
        await handleSearch('STANI')
        await handleSearch('JULIEN')
        await handleSearch('DUDE')
        await handleSearch('MARC')
        break;
      default:
    }
  }
  const handleSearch = async(value) => {
    console.log('***handleSearc', {value, tokenOptions, date:new Date()})
    let selected, body
    if(!value.match(/^0x/)){
      body = tokenOptions.filter((t) => t.symbol.toLowerCase() === value.toLowerCase())[0]
      if(body){
        selected = {
          id: body.name.toLowerCase(),
          symbol: body.symbol.toLowerCase(),
          token_address: body.contractAddress.toLowerCase(),
          decimals: body.decimals,
          image: body.logo,
          website:body.website,
          platform:body.platform
        }  
      }else{
        // setErrorMessage('No matching token for the symbol')
        return false
      }
    }else{
      selected = {
        token_address: body.name.toLowerCase()
      }
    }

    let query = getTokenQuery(selected.token_address)
    let res = await performQuery(query)
    if(!res.errors && res.data.tokens.length > 0){
      let token = res.data.tokens[0]
      selected = {...selected,...
      {
        id: token.symbol,
        symbol: token.symbol,
        token_address: token.id,
        eth: token.derivedETH,
        decimals: token.decimals,
        name:token.name
      }}
    }

    if(selected.token_address){
      let matched = coins.filter((c) => c.symbol.toLowerCase() === selected.symbol.toLowerCase())
      if(matched.length === 0){
        lookupTokenSymbol(selected)
      }
    }else{
      setErrorMessage('Token not found')
    }
  }

  const performQuery = async(query) => {
    const res = await fetch("https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2", {
        method: "POST",
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body:query
    });
    return await res.json()
  };

  const getTokenQuery = (address) => {
    return JSON.stringify({
      operationName:"Token",
      variables:{id:address},
      query:`
      query Token($id: String!){
        tokens(where: {id:$id}) {
          id
          symbol
          name
          decimals
          derivedETH
        }
      }
      `
    });
  };

  const fetchSuggestions = async(name) => {
    fetch(`https://api.covalenthq.com/v1/1/address/${name}/balances/?key=${C_KEY}`).then((data) =>{
      data.json().then((d)=>{
        console.log('***fetchSuggestions', {name, d})
        let tokenBalances = d.data.balances.map(c => { return {
          symbol:c.contract_ticker_symbol.toLowerCase(),
          token_address: c.contract_address.toLowerCase(),
          balance:c.balance
        }})
        let tokenOptionModified = tokenOptions.map(c => { return {
          symbol:c.symbol.toLowerCase(), token_address:c.contractAddress
        }})
        let intersection = _.intersectionBy(
          tokenBalances,
          tokenOptionModified,
          'symbol'
        )
        let difference = _.differenceBy(intersection, coins, 'token_address')
        setSuggestions(difference.map(d => d.symbol))
      })
    })
  }

  const toggleModal = async(e)=>{
    e.preventDefault()
    let symbol = e.target.text
    let coin = coins.filter(a => a.symbol === symbol.toLowerCase())[0]
    console.log({coin})
    setTokenDetail(coin)
    openModal()
    if(!tokenHolders[symbol]){
      let data = await fetch(`https://api.covalenthq.com/v1/1/tokens/${coin.token_address}/token_holders?key=${C_KEY}`)
      let d = await data.json()
      let obj = {}
      obj[symbol] = {}
      console.log('***d.data.items', d.data)
      obj[symbol].items = d.data.items.slice(0,10)
      obj[symbol].assets = new Array(d.data.items.slice(0,10).length)
      setTokenHolders({...tokenHolders, ...obj})
      setSpinnerMessage('Lookingup ENS and NFT assets')
      for (let i = 0; i < obj[symbol].items.length; i++) {
        let item = obj[symbol].items[i]
        let name = await provider.lookupAddress(item.address)
        let asset = (await (await fetch(`https://api.opensea.io/api/v1/assets?owner=${item.address}&order_direction=desc&offset=0&limit=10`)).json()).assets
        obj[symbol].assets[i] = asset
        console.log({address:item.address, asset, asset2:obj[symbol].assets[i]})
        item.name = name
        setTokenHolders({...tokenHolders, ...obj})
      }
      setSpinnerMessage(false)
    }
  }
  const openModal = ()=>{
    setIsOpen(true);
  }

  const afterOpenModal = () => {
    // references are now sync'd and can be accessed.
    // subtitle.style.color = '#f00';
  }

  const closeModal = () =>{
    setIsOpen(false);
  }

  const handleTokenLink = async(e)=>{
    e.preventDefault()
    let symbol = e.target.text
    handleSearch(symbol)
  }

  const handleAddressLink = async(e)=>{
    e.preventDefault()
    let name = e.target.text || e.target.textContent
    if(name.match(/^0x/)){
      readOnChainData([{address:name}])
      fetchSuggestions(name)
    }else{
      handleOtherAddress(name).then((a)=> {
        readOnChainData([a])
        fetchSuggestions(name)
      })
    }
  }

  const closeAndAddAddress = async(e)=>{
    closeModal()
    handleAddressLink(e)
  }

  const handleOtherAddress = async(value)=>{
    console.log('****handleOtherAddress2.1', value)
    let _value = value.trim()
    let _address = EMPTY_ADDRESS
    let _name
    try{
      if(_value.length === 42 && _value.match(/^0x/)){
        _address = _value
      } else if(_value.match(/eth$/)){
        _name = _value
        _address = await provider.resolveName(_value)
      }
    }catch(e){
      console.log(e)
    }
    return({
      name:_name,
      address:_address
    })
  }
  
  /* Open wallet selection modal. */
  const loadWeb3Modal = useCallback(async () => {
    let readOnlyProvider = new ethers.getDefaultProvider('homestead', {infura:NODE_KEY})
    let networkVersion = 1
    setNetworkId(parseInt(networkVersion))
    setProvider(readOnlyProvider);
  }, []);

  function getMatched(balances, eth, ethUsdPrice){
    let sorted = balances.map(b => {
      return parseInt(b * parseFloat(eth || 0) * ethUsdPrice)
    }).filter((b) => b > 0).sort()
    return {
      matchedLength: sorted.length,
      matchedMin: sorted[0]
    }
  }

  async function lookupTokenSymbol({id, symbol, eth, token_address, decimals, image, name, website, platform }) {
    let defaultProvider
    if(token_address){
      let newCoin = {
        id: id.toLowerCase(),
        symbol: symbol.toLowerCase(),
        token_address,
        decimals,
        image,
        eth,
        tokenBalances: [],
        name,
        website,
        platform
      }
      defaultProvider = getDefaultProvider('homestead', {infura:NODE_KEY});
      let denominator = Math.pow(10, decimals)
      const balanceChecker = new Contract(BALANCE_CHECKER_ADDRESS, abis.balanceChecker, defaultProvider);
      const batchAddresses = addresses.map(a => a.address)
      console.log('***batchAddresses', {batchAddresses})
      let batchResult = await balanceChecker.balances(batchAddresses, [newCoin.token_address]);

      for (let j = 0; j < batchResult.length; j++) {
        newCoin.tokenBalances.push(batchResult[j] / denominator)
      }
      setCoins((prevState) => {
        return [...prevState, newCoin]
      })
    }else{
      console.log('no token_address')
    }
  }

  async function readOnChainData(newAddresses) {
    if(
      addresses.map(a => a.address).includes(newAddresses[0].address) ||
      addresses.map(a => a.name).includes(newAddresses[0].name) 
    ){
      return false
    }
    const defaultProvider = getDefaultProvider();

    let batchAddresses;
    const batchTokens = [];
    if(newAddresses && newAddresses.length > 0){
      batchAddresses = [...addresses.map(a => a.address), ...newAddresses.map(a => a.address)]
      setAddresses([...addresses, ...newAddresses]);
    }
    for (let i = 0; i < coins.length; i++) {
      let coin = coins[i]
      batchTokens.push(coin.token_address)
    }
    const balanceChecker = new Contract(BALANCE_CHECKER_ADDRESS, abis.balanceChecker, defaultProvider);
    let batchResult = await balanceChecker.balances(batchAddresses, batchTokens);
    let matrix = []
    for (let i = 0; i < batchAddresses.length; i++) {
      for (let j = 0; j < batchTokens.length; j++) {
        if(!matrix[j]){
          matrix[j] = []
        }
        matrix[j][i] = batchResult[(i * batchTokens.length) + j]
      }
    }
    var cid = 0
    setCoins([...coins].map((coin) => {
      if(!coin.tokenBalances){
        coin.tokenBalances = []
      }
      let denominator = Math.pow(10, coin.decimals) 
      for (let i = 0; i < batchAddresses.length; i++) {
        let cell = matrix[cid][i]
        let delimited
        try{
          delimited = parseFloat(coin.decimals) === 18 ? parseFloat(ethers.utils.formatEther(cell)) : (cell.toNumber() / denominator)
        }catch(e){
          debugger
        }
        coin.tokenBalances[i] = delimited
      }
      cid = cid+1
      return coin
    }))
    setCoins(coins)
  }
  const hasTokenBalances = coins.length === 0 || !!coins[0].tokenBalances

  const { Option } = components;
  const IconOption = props => {
    return (
      <Option {...props}>
        <img
          src={props.data.logo}
          style={{ width: 36 }}
          alt={props.data.label}
        />
        {props.data.label}
      </Option>
    );
  }

  /* If user has loaded a wallet before, load it automatically. */
  useEffect(() => {
    fetch(`https://api.tryroll.com/v2/tokens`).then((data) =>{
      data.json().then((d)=>{
        let enhanced = d.map(dd => {
          dd.platform = 'tryroll'
          return dd
        })
        setTokenOptions(
          [...coinData,...enhanced].map((dd) => { return {
            ...dd,
            value:dd.symbol,
            label:dd.symbol
          }})
        )
      })
    })

    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd`).then((data) =>{
      data.json().then((d)=>{
        setEthUsdPrice(d.ethereum.usd)
      })
    })
    
    if (web3Modal.cachedProvider) {
      console.log('***web3Modal1')
      loadWeb3Modal();
    }else{
      loadWeb3Modal()
      console.log('***web3Modal2')
    }
  }, [loadWeb3Modal]);

  const labels = coins.map(c => c.symbol )
  const body = []
  for (var index = 0; index < addresses.length; ++index) {
    var {name, address} = addresses[index]
    var tokenBalances = coins.map(c => {
      if(c.tokenBalances && c.tokenBalances[index]){
        var t = c.tokenBalances[index]
        let usd = t * parseFloat(c.eth) * ethUsdPrice
        if(usd > 10000){
          return 100
        }else if (usd < 1){
          return 1
        }
        else{
          return d3.scaleLog().domain([10,10000]).range([0,100])(usd)
        }
      }else{
        return 0
      }
    })
    var obj = {
      name, address, tokenBalances
    }
    body.push(obj)
  }
  var colorLabels = d3.scaleOrdinal(d3.schemeCategory10).domain(body.map(b => b.name))
  let search = new URLSearchParams(window.location.search)
  let initialCoins = (search.get('coins') && search.get('coins').split(',')) || []
  let initialAddresses = (search.get('addresses') && search.get('addresses').split(',')) || []
  if(provider){
    if(tokenOptions.length > 0 && coins.length === 0){
      if(initialCoins.length > 0){
        for (var index = 0; index < initialCoins.length; ++index) {
          handleSearch(initialCoins[index])
        }
      }
    }
    if(coins.length === initialCoins.length && initialAddresses.length > addresses.length){
      for (var index = 0; index < initialAddresses.length; ++index) {
        Promise.all(initialAddresses.map(a => {
          return handleOtherAddress(a)
        })).then((_addresses)=> {
          readOnChainData(_addresses)
        })
      }
    }  
  }

  const query = `coins=${coins.map(c => `${c.symbol}`).join(',')}&addresses=${addresses.map(c => c.name).join(',')}`
  const twitterSharingURL = `${window.location.origin}/?${query}`;
  const shareText = `${addresses.map(a => `${a.name}`).join(' ')} are stuck with ${
    coins.map(c => `${ c.symbol.match(/\$/) ? '' : '$' }${c.symbol}`).join(' ')
  }. Check out the personal token stuck`
  const shareMessage = `https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(twitterSharingURL)}`
  
  let displyableSuggestions = _.difference(suggestions, coins.map(c => c.symbol.toLowerCase()))
  console.log('***', {tokenHolders})
  const modifiedCoins = coins.map(c => {return({...c, ...getMatched(c.tokenBalances, c.eth, ethUsdPrice)})})
  return (
    <div>
      <Header>
      </Header>
      <Body>
        { provider && coins.length > 2 && networkId === 1 ? (
          <SpiderGraph
            labels={labels}
            body={body}
          />
        ) : (
          <>
            <Image src={logo} alt="react-logo" />
            <iframe width="50" height="50" src="https://www.youtube.com/embed/h2jvHynuMjI" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </>
        )}
        <Modal
          isOpen={modalIsOpen}
          onAfterOpen={afterOpenModal}
          onRequestClose={closeModal}
          style={{}}
          contentLabel="Example Modal"
        >
          <Button onClick={closeModal}>Close Modal</Button>
          {tokenDetail && (
            <div>
              <h2>
              {
                tokenDetail.symbol
              }
              { tokenDetail.name && <>({tokenDetail.name})</> }
              </h2>
              <img style={{width:"100px", margin:'1.5em' }} src={tokenDetail.image}></img>
              <h2>Whales (top 10 token holders)</h2>
              { spinnerMessage && (<div style = {{color:"orange"}}>{spinnerMessage}</div>)}
              { tokenHolders[tokenDetail.symbol] && tokenHolders[tokenDetail.symbol].items && (
                <ul>
                  {tokenHolders[tokenDetail.symbol].items.slice(0, 20).map((h, i) => {
                  let percent = parseInt(h.balance) / parseInt(h.total_supply) * 100
                  let denominator = Math.pow(10, tokenDetail.decimals)
                  let asset = tokenHolders[tokenDetail.symbol].assets[i]
                  console.log('****asset', i, tokenDetail.symbol, tokenHolders[tokenDetail.symbol])
                  return (
                    <li style={{margin:'1em'}}>{ h.name ? (
                      <a className='link-button' href="#" onClick={closeAndAddAddress}>{h.name }</a>
                    ) : (
                      <a className='link-button' style={{
                        overflow: 'hidden',
                        textOverflow:'ellipsis',
                        width:'100px',
                        display:'inline-block',
                        verticalAlign: 'middle'
                      }} href="#" onClick={closeAndAddAddress}>{ h.address }</a>
                    )}: { (h.balance / denominator).toFixed(3) } ({percent.toFixed(3)} %)
                    { asset && asset.length > 0 && (<p>
                      { asset.map(a => {
                      return(
                          <a href={a.external_link || a.permalink } target="_blank">
                            <img width="30px" src={a.image_thumbnail_url} />
                          </a>
                        )
                      }) }
                    </p>)}
                    </li>
                  )
                })}
                </ul>
              )}
              { !spinnerMessage && (<div style = {{color:"green"}}>Click green button to show token balances</div>)}
            </div>
          )}
        </Modal>
        <h2>Stuck with U</h2>
        { provider && networkId === 1 ? (
        <div style={{textAlign:'center'}}>
          <div style={{overflowX:"auto", width:"99%"}}>
          <p>Tokens are the new social graph. Discover who holds which personal tokens.</p>
          <table>
            <tr>
              <th></th>
              <th></th>
              {addresses.map((a) => {
                return (
                  <th style={{color:colorLabels(a.name || a.address)}}>
                    { a.name || (a.address && `${a.address.slice(0,5)}...`)}
                  </th>
                )
              })}
            </tr>
            {_.orderBy(modifiedCoins, ['matchedLength', 'matchedMin'], ['desc', 'desc']).map((c, index) => {
            return(
              <tr style={{textAlign:'left'}}>
                <td><img width="50px" src={c.image}></img></td>
                <td>{index + 1}<a href="#" onClick={toggleModal}>{c.symbol}</a></td>
                {c && c.tokenBalances && c.tokenBalances.map((b) => {
                  return (
                    <td>
                      { (b > 0 && b < 1) ? 0.1 : parseInt(b) }
                      {c.eth && `($${parseInt(b * parseFloat(c.eth) * ethUsdPrice)})`}
                    </td>
                  )
                })}

              </tr>
            )
          })}
          </table>
          </div>
          {
            hasTokenBalances && (
              <p>
                <h2>Step 1: Add Personal Tokens
                   {/* (sample: */}
                  {/* <a className='link-button' href="#" onClick={addSampleTokens}>dao</a>
                  <a className='link-button' href="#" onClick={addSampleTokens}>vc</a>
                  <a className='link-button' href="#" onClick={addSampleTokens}>defi</a>
                  <a className='link-button' href="#" onClick={addSampleTokens}>media</a>
                  <a className='link-button' href="#" onClick={addSampleTokens}>entertainer</a>
                  <a className='link-button' href="#" onClick={addSampleTokens}>game</a>
                  <a className='link-button' href="#" onClick={addSampleTokens}>art</a> */}
                )</h2>
                <p style={{color:'red'}}>{errorMessage}</p>
                <CreatableSelect
                styles={customStyles}
                components={{ Option: IconOption }}
                options={tokenOptions} onChange={(e) => { handleSearch(e.value)}} search={true} name="language" placeholder="Select token or add token address"
                />
                {
                  (coins.length > 0 && coins.length < 3) && (
                    <p style={{color:'red'}}>Please add at least 3 tokens to go to show a graph</p>
                  )
                }
              </p>
            )
          }
          {displyableSuggestions.length > 0 && (<p style={{wordWrap:'break-word', width:'800px'}}>
            <span style={{ fontWeight:'bold' }}>suggestions</span>
            {displyableSuggestions.map(s => {
            return (
              <span><a className='link-button' onClick={handleTokenLink} href="#">{s}</a></span>
            )
          })}
          </p>)}

          { coins.length > 2 && (
            <div>
            <p>
              <h2>Step2: Add addresses to show token balances</h2>
            </p>
            <p style={{width:'800px'}}>Try &nbsp;
              <a className='link-button' href="#" onClick={handleAddressLink}>alexmasmej.eth</a>
              <a className='link-button' href="#" onClick={handleAddressLink}>joonian.eth</a>
              <a className='link-button' href="#" onClick={handleAddressLink}>flynnjamm.eth</a>
              <a className='link-button' href="#" onClick={handleAddressLink}>vitalik.eth</a>
              <a className='link-button' href="#" onClick={handleAddressLink}>ameen.eth</a>
              <a className='link-button' href="#" onClick={handleAddressLink}>pet3rpan.eth</a>
              <a className='link-button' href="#" onClick={handleAddressLink}>coopahtroopa.eth</a>
               etc.
               <p style={{paddingTop:'1em'}}>
                 You can find more ENS names at <a href="https://explore.duneanalytics.com/public/dashboards/7y5anMQVu38kAL4x95qFlFCDTXLHXKhmNBJd5CD7" target="_blank">Dune Analytics</a>&nbsp;
                 or&nbsp;
                 <a href="https://twitter.com/search?q=.eth&src=typed_query&f=user" target="_blank">Twitter</a>
               </p>
               <br/>You don't have ENS? Get it <a href="http://app.ens.domains" target="_blank">NOW</a></p>
            <input onChange={(e)=> {
              handleOtherAddress(e.target.value).then(({name, address})=>{
                if(name){
                  fetchSuggestions(name)
                  setOtherName(name)
                }
                if(address){
                  setOtherAddress(address)
                }
              })
            }} placeholder="Enter ENS name or Eth address" defaultValue={otherName || otherAddress}></input>
            {otherAddress === EMPTY_ADDRESS ? (<p style={{color:'red'}}>Invalid address</p>) : (<p>{otherAddress}</p>)}
            <p>
              <Button disabled = {otherAddress === EMPTY_ADDRESS} onClick={(e) => {
                e.preventDefault()
                let newAddress = {name:otherName, address:otherAddress}
                if(otherName){
                  fetchSuggestions(name)
                }
                console.log({coins})
                readOnChainData([newAddress])
              }}>
              Add Token Balances
              </Button>
            </p>
            </div>
          )  }
                {coins.length > 2 && addresses.length > 0 && (
                  <p>
                    <h2> Step 3: Share your discovery</h2>
                    <a class="twitter-share-button"
                      href={shareMessage}>
                    Tweet</a>
                  </p>
                )}

        </div>
        ) : (
          <>
            <p>I'm stuck with $ALEX, stuck with $JAMM, stuck with $JOON</p>
            <WalletButton provider={provider} loadWeb3Modal={loadWeb3Modal} />
            {
              networkId !== 1 && (<p style={{color:"red"}}>Please connect to Mainnet</p>)
            }
          </>
        )}
      </Body>
    </div>
  );
}

export default App;
