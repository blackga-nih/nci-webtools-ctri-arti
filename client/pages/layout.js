import html from "solid-js/html";

import Header from "../components/header.js";
import InactivityDialog from "../components/inactivity-dialog.js";
import Nav from "../components/nav.js";
import PrivacyNotice from "../components/privacy-notice.js";

export default function Layout(props) {
  return html`
    <${Header} />
    <${Nav} />
    <${PrivacyNotice} />
    <${InactivityDialog} />
    <main class="d-flex flex-column flex-grow-1 position-relative" style="min-height:0">
      ${props.children}
    </main>
  `;
}
