import React, { useCallback, useEffect, useState } from "react";
import { Contract } from "@ethersproject/contracts";
import { Web3Provider, getDefaultProvider } from "@ethersproject/providers";
import { useQuery } from "@apollo/react-hooks";
import coinData from "./components/coins"
import { Body, Button, Header, Image, Link } from "./components";
import { web3Modal, logoutOfWeb3Modal } from './utils/web3Modal'
import logo from "./logo.png";
import ENS, { getEnsAddress, namehash } from '@ensdomains/ensjs'
import { abis } from "@project/contracts";
import GET_TRANSFERS from "./graphql/subgraph";
import { BackgroundColor } from "chalk";
import SpiderGraph from './SpiderGraph'
import { components } from "react-select";
import CreatableSelect from 'react-select/creatable'
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
  const [addresses, setAddresses] = useState([]);
  const [otherAddress, setOtherAddress] = useState();
  const [errorMessage, setErrorMessage] = useState();
  const [otherName, setOtherName] = useState();
  const [coins, setCoins] = useState([]);
  const [update, setUpdate] = useState(new Date())
  const [tokenSymbol, setTokenSymbol] = useState()
  const [tokenOptions, setTokenOptions] = useState([])
  const [ethUsdPrice, setEthUsdPrice] = useState()
  const [ens, setEns] = useState();

  const addSampleTokens = async(e) =>{
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
        await handleSearch('EVAN')
        await handleSearch('JAMM')
        break;
      case 'dao':
        await handleSearch('pew')
        await handleSearch('PETER')
        await handleSearch('ALEX')
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
        await handleSearch('KARMA')
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
          image: body.logo  
        }  
      }else{
        setErrorMessage('No matching token for the symbol')
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
        decimals: token.decimals
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

  const handleOtherAddress = async(event)=>{
    console.log('handleOtherAddress', event.target.value)
    let _value = event.target.value.trim()
    let _address = EMPTY_ADDRESS
    let _name
    try{
      if(_value.length === 42 && _value.match(/^0x/)){
        _address = _value
      } else if(_value.match(/eth$/)){
        _name = _value
        _address = await ens.name(_value).getAddress()
      }
    }catch(e){
      console.log(e)
    }
    if(_name){
      setOtherName(_name)
    }
    if(_address){
      setOtherAddress(_address)
    }
  }
  
  /* Open wallet selection modal. */
  const loadWeb3Modal = useCallback(async () => {
    const newProvider = await web3Modal.connect();
    let networkVersion = newProvider.networkVersion || 1
    const ensAddress = getEnsAddress(networkVersion)
    const selectedAddress = newProvider.selectedAddress || newProvider.accounts[0]
    const _provider = new Web3Provider(newProvider)
    const _ens = new ENS({ provider:newProvider, ensAddress })
    setProvider(_provider);
    setEns(_ens)
    setOtherAddress(selectedAddress);
    const { name } = await _ens.getName(selectedAddress)
    setOtherName(name)
  }, []);

  async function lookupTokenSymbol({id, symbol, eth, token_address, decimals, image }) {
    let defaultProvider
    if(token_address){
      let newCoin = {
        id: id.toLowerCase(),
        symbol: symbol.toLowerCase(),
        token_address,
        decimals,
        image,
        eth,
        tokenBalances: []
      }
      defaultProvider = getDefaultProvider();
      let denominator = Math.pow(10, decimals)
      const balanceChecker = new Contract(BALANCE_CHECKER_ADDRESS, abis.balanceChecker, defaultProvider);
      const batchAddresses = addresses.map(a => a.address)
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

  async function readOnChainData(newAddress) {
    const defaultProvider = getDefaultProvider();

    let batchAddresses;
    const batchTokens = [];
    let otherTokenBalance
    console.log('***readOnChainData1', {length:addresses.length})
    if(newAddress){
      batchAddresses = addresses.map(a => a.address)  
      batchAddresses.push(otherAddress)
      setAddresses([...addresses, newAddress]);
    }
    for (let i = 0; i < coins.length; i++) {
      let coin = coins[i]
      batchTokens.push(coin.token_address)
    }
    console.log('***readOnChainData2', {length:addresses.length, batchAddresses, batchTokens})
    const balanceChecker = new Contract(BALANCE_CHECKER_ADDRESS, abis.balanceChecker, defaultProvider);
    let batchResult = await balanceChecker.balances(batchAddresses, batchTokens);
    console.log('***batchResult1', {batchResult})
    let matrix = []
    for (let i = 0; i < batchAddresses.length; i++) {
      console.log('***batchResult2', i)
      for (let j = 0; j < batchTokens.length; j++) {
        console.log('***batchResult3', i, j, batchResult[(i * batchTokens.length) + j])
        if(!matrix[j]){
          matrix[j] = []
        }
        matrix[j][i] = batchResult[(i * batchTokens.length) + j]
        // if(!coins[j].batchAddresses){
        //   coins[j].batchAddresses = []
        // }
        // let denominator = Math.pow(10, coins[j].decimals) 
        // coins[j].batchAddresses[i] = matrix[j][i] / denominator
      }
    }
    console.log('***batchResult4', {matrix, coins})
    var cid = 0
    setCoins([...coins].map((coin) => {
      if(!coin.tokenBalances){
        coin.tokenBalances = []
      }
      let denominator = Math.pow(10, coin.decimals) 
      for (let i = 0; i < batchAddresses.length; i++) {
        let cell = matrix[cid][i]
        // debugger
        coin.tokenBalances[i] = cell.toNumber() / denominator 
        console.log('***batchResult5', {cid, i, cell, coin})
      }
      cid = cid+1
      return coin
    }))
    // for (let i = 0; i < batchAddresses.length; i++) {
    //   for (let j = 0; j < coins.length; i++) {
    //     let denominator = Math.pow(10, coins[j].decimals) 
    //     let coin = coins[j]
    //     let batchAddress = batchAddresses[i]
    //     console.log('***', {i,j, denominator})
    //     if(!coin.tokenBalances){
    //       coin.tokenBalances = []
    //     }
    //     coins.tokenBalances[j] = matrix[j][i] / denominator
    //   }
    // }
    setCoins(coins)
    // for (let i = 0; i < batchResult.length; i++) {
    //   otherTokenBalance = batchResult[i];
    //   setCoins((prevState) => {
    //     let denominator = Math.pow(10, prevState[i].decimals) 
    //     if(!prevState[i].tokenBalances){
    //       prevState[i].tokenBalances = [otherTokenBalance / denominator]
    //     }else{
    //       prevState[i].tokenBalances.push(otherTokenBalance / denominator )
    //     }
    //     return prevState
    //   })
    //   setUpdate(new Date())
    // }
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
        console.log({d})
        setTokenOptions(
          [...coinData,...d].map((dd) => { return {
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
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const labels = coins.map(c => c.symbol )
  const body = []
  for (var index = 0; index < addresses.length; ++index) {
    var {name, address} = addresses[index]
    var tokenBalances = coins.map(c => {
      if(c.tokenBalances && c.tokenBalances[index]){
        var t = c.tokenBalances[index]
        if(t == 0){
          return 0
        }else if(t < 10){
          return 1
        }else if(t < 1000){
          return 10
        }else if(t < 5000){
          return 20
        }else if(t < 10000){
          return 50
        }else if(t < 50000){
          return 70
        }else{
          return 100
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
  console.log('***', {coins, tokenOptions, ethUsdPrice, date:new Date()})
  let search = new URLSearchParams(window.location.search)
  let initialCoins = (search.get('coins') && search.get('coins').split(',')) || []
  let initialAddresses = (search.get('addresses') && search.get('addresses').split(',')) || []
  if(tokenOptions.length > 0 && coins.length === 0){
    if(initialCoins.length > 0){
      for (var index = 0; index < initialCoins.length; ++index) {
        console.log(initialCoins[index])
        handleSearch(initialCoins[index])
      }
    }
  }
  const shareMessage = `https://twitter.com/intent/tweet?text=Do you own ${coins.map(c => `$${c.symbol}`).join(' ')}? Compare token balance with your friends at ${window.location.origin}/?coins=${coins.map(c => `${c.symbol}`).join(',')}`
  return (
    <div>
      <Header>
        <WalletButton provider={provider} loadWeb3Modal={loadWeb3Modal} />
      </Header>
      <Body>
        { ens && coins.length > 0 ? (
          <SpiderGraph
            labels={labels}
            body={body}
          />
        ) : (
          <Image src={logo} alt="react-logo" />
        )}
        <h2>Stuck with U</h2>
        { ens ? (
        <div style={{textAlign:'center'}}>
          { coins.length > 0 && (
            <div>
            <p>Try <a href="#" onClick={(e)=>console.log(e.target)}>alexmasmej.eth</a> , joonian.eth , flynnjamm.eth, vitalik.eth , ljxie.eth, coopahtroopa.eth, etc. You don't have ENS? Get it <a href="http://app.ens.domains" >NOW</a></p>
            <input onChange={handleOtherAddress} placeholder="Enter ENS name or Eth address" defaultValue={otherName || otherAddress}></input>
            {otherAddress === EMPTY_ADDRESS ? (<p style={{color:'red'}}>Invalid address</p>) : (<p>{otherAddress}</p>)}
            <p>
              <Button disabled = {otherAddress === EMPTY_ADDRESS} onClick={() => {
                console.log('*addresses1', addresses.length)
                setAddresses([...addresses, ]);
                console.log('*addresses2', addresses.length)
                let newAddress = {name:otherName, address:otherAddress}
                readOnChainData(newAddress)
              }}>
              Add Token Balances
              </Button>
            </p>
            </div>
          )  }
          <div style={{overflowX:"auto", width:"99%"}}>
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
            {coins.map((c) => {
            return(
              <tr>
                <td><img width="50px" src={c.image}></img></td>
                <td>{c.symbol}</td>
                {c && c.tokenBalances && c.tokenBalances.map((b) => {
                  return (
                    <td>
                      { parseInt(b) }
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
            (true || hasTokenBalances) && (
              <p>
                <h2>Add Personal Tokens (sample:
                  <a href="#" onClick={addSampleTokens}>dao</a>,
                  <a href="#" onClick={addSampleTokens}>vc</a>,
                  <a href="#" onClick={addSampleTokens}>defi</a>,
                  <a href="#" onClick={addSampleTokens}>media</a>,
                  <a href="#" onClick={addSampleTokens}>entertainer</a>,
                  <a href="#" onClick={addSampleTokens}>game</a>,
                  <a href="#" onClick={addSampleTokens}>art</a>
                )</h2>
                <p style={{color:'red'}}>{errorMessage}</p>
                <CreatableSelect
                styles={customStyles}
                components={{ Option: IconOption }}
                options={tokenOptions} onChange={(e) => { handleSearch(e.value)}} search={true} name="language" placeholder="Select token or add token address"
                />
                {coins.length > 0 && (
                  <>
                    <h3>Did you find your favorite personal token combos?</h3>
                    <a class="twitter-share-button"
                      href={shareMessage}>
                    Tweet Your favorite personal tokens</a>
                  </>
                )}
              </p>
            )
          }
        </div>
        ) : (
          <>
            <p>I'm stuck with $ALEX, stuck with $JAMM, stuck with $JOON</p>
            <WalletButton provider={provider} loadWeb3Modal={loadWeb3Modal} />
          </>
        )}
      </Body>
    </div>
  );
}

export default App;
