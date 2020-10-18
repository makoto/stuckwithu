import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";

// Web3Modal also supports many other wallets.
// You can see other options at https://github.com/Web3Modal/web3modal
export const web3Modal = new Web3Modal({
  network: "mainnet",
  cacheProvider: true,
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        infuraId: "63c463ac9dff4296ac5ac483aa660138",
      },
    },
  },
});

export const logoutOfWeb3Modal = async function() {
  await web3Modal.clearCachedProvider();
  window.location.reload();
};
