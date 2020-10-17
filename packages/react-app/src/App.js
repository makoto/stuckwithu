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
import Select, { components } from "react-select";

const customStyles = {
  option: (provided, state) => ({
    ...provided
    // ,
    // borderBottom: '1px dotted pink',
    // color: state.isSelected ? 'red' : 'blue',
    // padding: 20,
  }),
  control: () => ({
    // none of react-select's styles are passed to <Control />
    width: 500,
  }),
  singleValue: (provided, state) => {
    const opacity = state.isDisabled ? 0.5 : 1;
    const transition = 'opacity 300ms';

    return { ...provided, opacity, transition };
  }
}

const d3 = require('d3')
const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000'
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
  const [otherName, setOtherName] = useState();
  const [coins, setCoins] = useState(coinData);
  const [update, setUpdate] = useState(new Date())
  const [tokenSymbol, setTokenSymbol] = useState()
  const [tokenOptions, setTokenOptions] = useState()
  const [ens, setEns] = useState();

  const handleToken = async(event) => {
    console.log('handleToken', event)

    let _value = event.target.value
    setTokenSymbol(_value)
  }

  const handleSearch = async(event) => {
    console.log('handleSearch', event)
    let selected = tokenOptions.filter((t) => t.symbol === event.label)[0]
    lookupTokenSymbol(selected)
  }

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
    const ensAddress = getEnsAddress(newProvider.networkVersion)
    const _provider = new Web3Provider(newProvider)
    const _ens = new ENS({ provider:newProvider, ensAddress })
    const { name } = await _ens.getName(newProvider.selectedAddress)
    setProvider(_provider);
    setEns(_ens)
    setOtherAddress(newProvider.selectedAddress);
    setOtherName(name)
  }, []);

  async function lookupTokenSymbol(body) {
    // const response = await fetch(`https://api.tryroll.com/v2/tokens/${tokenSymbol}`);
    // const body = await response.json()
    let ceaErc20, defaultProvider
    if(body.contractAddress){
      let newCoin = {
        id: body.name.toLowerCase(),
        symbol: body.symbol.toLowerCase(),
        token_address: body.contractAddress,
        decimals: body.decimals,
        image: body.logo,
        tokenBalances: []
      }
      defaultProvider = getDefaultProvider();
      ceaErc20 = new Contract(newCoin.token_address, abis.erc20, defaultProvider);
      let denominator = Math.pow(10, body.decimals)
      for (let j = 0; j < addresses.length; j++) {
        let newBalance = await ceaErc20.balanceOf(addresses[j].address)
        newCoin.tokenBalances.push(newBalance / denominator)
      }

      setCoins((prevState) => {
        return [...prevState, newCoin]
      })
    }else{
      console.log('no contractAddress')
    }
  }


  async function readOnChainData() {
    const coinsWithAddress = coins.filter(c => c.token_address )
    const defaultProvider = getDefaultProvider();
    let ceaErc20, tokenBalance, otherTokenBalance
    setAddresses([...addresses, {name:otherName, address:otherAddress}]);
    for (let i = 0; i < coinsWithAddress.length; i++) {
      let coin = coinsWithAddress[i]
      ceaErc20 = new Contract(coin.token_address, abis.erc20, defaultProvider);
      otherTokenBalance = await ceaErc20.balanceOf(otherAddress);
      setCoins((prevState) => {
        let denominator = Math.pow(10, prevState[i].decimals)
        if(!prevState[i].tokenBalances){
          prevState[i].tokenBalances = [otherTokenBalance / denominator]
        }else{
          prevState[i].tokenBalances.push(otherTokenBalance / denominator )
        }
        return prevState
      })
      setUpdate(new Date())
    }
  }
  const hasTokenBalances = !!coins[0].tokenBalances

  const { Option } = components;
  const IconOption = props => {
    console.log('***IconOption', {props})
    // debugger
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
          d.map((dd) => { return {
            ...dd,
            value:dd.symbol,
            label:dd.symbol
          }})
        )
      })
    })
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  React.useEffect(() => {
    if (!loading && !error && data && data.transfers) {
      console.log({ transfers: data.transfers });
    }
  }, [loading, error, data, coins]);
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

  return (
    <div>
      <Header>
        <WalletButton provider={provider} loadWeb3Modal={loadWeb3Modal} />
      </Header>
      <Body>
        { !ens ? (
          <Image src={logo} alt="react-logo" />
        ) : (
          <SpiderGraph
            labels={labels}
            body={body}
          />
        )}
        <h2>Stuck with U</h2>
        { ens ? (
        <>
          <p>Try alexmasmej.eth , joonian.eth , flynnjamm.eth, vitalik.eth , ljxie.eth, coopahtroopa.eth, etc. You don't have ENS? Get it <a href="http://app.ens.domains" >NOW</a></p>
          <input onChange={handleOtherAddress} placeholder="Enter ENS name or Eth address" defaultValue={otherName || otherAddress}></input>
          {otherAddress === EMPTY_ADDRESS ? (<p style={{color:'red'}}>Invalid address</p>) : (<p>{otherAddress}</p>)}
          <p>
            <Button disabled = {otherAddress === EMPTY_ADDRESS} onClick={() => readOnChainData(coins, addresses, otherAddress)}>
            Add Token Balances
            </Button>
          </p>
          <table>
            <tr>
              <th></th>
              <th></th>
              {addresses.map((a) => {
                return (
                  <th style={{color:colorLabels(a.name || a.address)}}>
                    { a.name || (a.address && a.address.slice(0,5))}...  
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
                      { b }
                    </td>
                  )
                })}

              </tr>
            )
          })}
          </table>
          {
            hasTokenBalances && (
              <>
                <Select
                styles={customStyles}
                components={{ Option: IconOption }}
                options={tokenOptions} onChange={handleSearch} search={true} name="language" placeholder="Add more token symbol" />
              </>
            )
          }
        </>
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
