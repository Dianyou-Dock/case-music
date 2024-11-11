import type { AppProps } from "next/app";
import { Provider } from "@/components/ui/provider";
import Layout from "./layout";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Provider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </Provider>
  );
}
