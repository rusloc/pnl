//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { ConnectionProbe } from './components/connection-probe.component';
import { PnlApp } from './pnl/pnl-app';

// The P&L report (spec docs/Requirements.md, design docs/design/). Open the app
// with `#probe` to reach the lhraw connection + aggregation probe instead
// (manual check for ADR-0005 after a deploy).
function App() {
  const probe = typeof window !== 'undefined' && window.location.hash === '#probe';
  return probe ? <ConnectionProbe /> : <PnlApp />;
}

export default App;
