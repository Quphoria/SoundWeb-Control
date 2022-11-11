import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <style>
            @font-face {
              font-family: "Microsoft Sans Serif";
              src: url("https://db.onlinewebfonts.com/t/2442df04682466647c9b737e374dd1ef.eot"); /* IE9*/
              src: url("https://db.onlinewebfonts.com/t/2442df04682466647c9b737e374dd1ef.eot?#iefix") format("embedded-opentype"), /* IE6-IE8 */
              url("https://db.onlinewebfonts.com/t/2442df04682466647c9b737e374dd1ef.woff2") format("woff2"), /* chrome firefox */
              url("https://db.onlinewebfonts.com/t/2442df04682466647c9b737e374dd1ef.woff") format("woff"), /* chrome firefox */
              url("https://db.onlinewebfonts.com/t/2442df04682466647c9b737e374dd1ef.ttf") format("truetype"), /* chrome firefox opera Safari, Android, iOS 4.2+*/
              url("https://db.onlinewebfonts.com/t/2442df04682466647c9b737e374dd1ef.svg#Microsoft Sans Serif") format("svg"); /* iOS 4.1- */
            }
          </style>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument