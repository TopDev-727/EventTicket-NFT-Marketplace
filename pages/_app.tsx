import Layout from "@/components/ui/layout/Layout";
import theme from "@/utils/theme";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { ChakraProvider } from "@chakra-ui/react";
import "@fontsource/kadwa";
import "@fontsource/lato";
import "@fontsource/open-sans";
import { AppProps } from "next/app";
import Head from "next/head";
import { GlobalStyle } from "../css/globalStyle";
import { useEffect, FC, ReactNode } from "react";
import { observer } from "mobx-react-lite";
import userStore from "@/mobx/UserStore";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { IntercomProvider } from 'react-use-intercom';
import mixpanel from 'mixpanel-browser';
import { MixpanelProvider } from 'react-mixpanel-browser';
import TagManager from 'react-gtm-module';


require("../css/rsuite.css");

require("@solana/wallet-adapter-react-ui/styles.css");

const WalletConnectionProvider = dynamic<{ children: ReactNode }>(
  () =>
    import("../components/Components/WalletConnectionProvider").then(
      ({ WalletConnectionProvider }) => WalletConnectionProvider
    ),
  {
    ssr: true,
  }
);

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  useEffect(() => {
    if (!userStore.loggedIn && userStore.loaded) {
      if (
        router.pathname.includes("collection") ||
        router.pathname.includes("profile") ||
        router.pathname.includes("recruit") ||
        router.pathname.includes("create/step")
      ) {
        router.push("/athletes/signin");
      }
    }
  }, [userStore.loggedIn, userStore.loaded, router.pathname]);

  useEffect(() => {
    TagManager.initialize({ gtmId: 'GTM-KP825Q5' });
  }, []);


  return (
    <ChakraProvider theme={theme}>
      <WalletConnectionProvider>
        <WalletModalProvider>
          <MixpanelProvider token={"b78dc989c036b821147f68e00c354313"} >
            <IntercomProvider appId={"b3ms6uff"} >
              <Head>
                <title>Verified Ink</title>
                <meta
                  property="og:image"
                  content="https://verifiedink.us/img/verified-ink-site.png"
                  key="preview"
                />
                <script
                  async
                  src="https://www.googletagmanager.com/gtag/js?id=G-68N30YNDQ1"
                ></script>
                <script
                  dangerouslySetInnerHTML={{
                    __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'G-68N30YNDQ1',{
            cookie_flags: 'secure;samesite=none'
          });
          `,
                  }}
                />
              </Head>
              <GlobalStyle />
              <Layout>
                <Component {...pageProps} />
              </Layout>
            </IntercomProvider>
          </MixpanelProvider>
        </WalletModalProvider>
      </WalletConnectionProvider>
    </ChakraProvider>
  );
}

export default observer(MyApp);
