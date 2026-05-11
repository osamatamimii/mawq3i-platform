import thmanyahLight from './assets/fonts/thmanyahsans-Light.woff2?url';
import thmanyahRegular from './assets/fonts/thmanyahsans-Regular.woff2?url';
import thmanyahMedium from './assets/fonts/thmanyahsans-Medium.woff2?url';
import thmanyahBold from './assets/fonts/thmanyahsans-Bold.woff2?url';
import thmanyahBlack from './assets/fonts/thmanyahsans-Black.woff2?url';

export function injectThmanyahFont() {
  const style = document.createElement('style');
  style.id = 'thmanyah-font';
  style.textContent = `
    @font-face {
      font-family: 'Thmanyah';
      src: url('${thmanyahLight}') format('woff2');
      font-weight: 300;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Thmanyah';
      src: url('${thmanyahRegular}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Thmanyah';
      src: url('${thmanyahMedium}') format('woff2');
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Thmanyah';
      src: url('${thmanyahBold}') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Thmanyah';
      src: url('${thmanyahBlack}') format('woff2');
      font-weight: 900;
      font-style: normal;
      font-display: swap;
    }
    html, body, * {
      font-family: 'Thmanyah', sans-serif !important;
    }
  `;
  document.head.appendChild(style);
}
