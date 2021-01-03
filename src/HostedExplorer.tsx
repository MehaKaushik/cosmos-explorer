import { useBoolean } from "@uifabric/react-hooks";
import * as Msal from "msal";
import { initializeIcons } from "office-ui-fabric-react";
import * as React from "react";
import { render } from "react-dom";
import ChevronRight from "../images/chevron-right.svg";
import "../less/hostedexplorer.less";
import { AuthType } from "./AuthType";
import { ConnectExplorer } from "./ConnectExplorer";
import { DatabaseAccount } from "./Contracts/DataModels";
import { DirectoryPickerPanel } from "./DirectoryPickerPanel";
import { AccountSwitchComponent } from "./Explorer/Controls/AccountSwitch/AccountSwitchComponent";
import "./Explorer/Menus/NavBar/MeControlComponent.less";
import { FeedbackCommandButton } from "./FeedbackCommandButton";
import { usePortalAccessToken } from "./hooks/usePortalAccessToken";
import { MeControl } from "./MeControl";
import "./Platform/Hosted/ConnectScreen.less";
import "./Shared/appInsights";
import { SignInButton } from "./SignInButton";

initializeIcons();

const msal = new Msal.UserAgentApplication({
  cache: {
    cacheLocation: "localStorage"
  },
  auth: {
    authority: "https://login.microsoft.com/common",
    clientId: "203f1145-856a-4232-83d4-a43568fba23d",
    redirectUri: "https://dataexplorer-dev.azurewebsites.net" // TODO! This should only be set in development
  }
});

interface HostedExplorerChildFrame extends Window {
  authType: AuthType;
  databaseAccount: DatabaseAccount;
  authorizationToken: string;
}

const cachedAccount = msal.getAllAccounts()?.[0];
const cachedTenantId = localStorage.getItem("cachedTenantId");

const App: React.FunctionComponent = () => {
  // Hooks for handling encrypted portal tokens
  const params = new URLSearchParams(window.location.search);
  const [encryptedToken, setEncryptedToken] = React.useState<string>(params && params.get("key"));
  const encryptedTokenMetadata = usePortalAccessToken(encryptedToken);

  // Hooks for showing/hiding panel
  const [isOpen, { setTrue: openPanel, setFalse: dismissPanel }] = useBoolean(false);

  // Hooks for AAD authentication
  const [isLoggedIn, { setTrue: setLoggedIn, setFalse: setLoggedOut }] = useBoolean(
    Boolean(cachedAccount && cachedTenantId) || false
  );
  const [account, setAccount] = React.useState<Msal.Account>(cachedAccount);
  const [tenantId, setTenantId] = React.useState<string>(cachedTenantId);
  const [graphToken, setGraphToken] = React.useState<string>();
  const [armToken, setArmToken] = React.useState<string>();
  const [databaseAccount, setDatabaseAccount] = React.useState<DatabaseAccount>();

  const login = React.useCallback(async () => {
    const response = await msal.loginPopup();
    setLoggedIn();
    setAccount(response.account);
    setTenantId(response.tenantId);
    localStorage.setItem("cachedTenantId", response.tenantId);
  }, []);

  const logout = React.useCallback(() => {
    setLoggedOut();
    localStorage.removeItem("cachedTenantId");
    msal.logout();
  }, []);

  const ref = React.useRef<HTMLIFrameElement>();

  React.useEffect(() => {
    if (account && tenantId) {
      Promise.all([
        msal.acquireTokenSilent({
          scopes: ["https://graph.windows.net//.default"]
        }),
        msal.acquireTokenSilent({
          scopes: ["https://management.azure.com//.default"]
        })
      ]).then(([graphTokenResponse, armTokenResponse]) => {
        setGraphToken(graphTokenResponse.accessToken);
        setArmToken(armTokenResponse.accessToken);
      });
    }
  }, [account, tenantId]);

  React.useEffect(() => {
    // If ref.current is undefined no iframe has been rendered
    if (ref.current) {
      const frameWindow = ref.current.contentWindow as HostedExplorerChildFrame;
      frameWindow.authType = AuthType.AAD;
      frameWindow.databaseAccount = databaseAccount;
      frameWindow.authorizationToken = armToken;
      // const frameWindow = ref.current.contentWindow;
      // frameWindow.authType = AuthType.EncryptedToken;
      // frameWindow.encryptedToken = encryptedToken;
      // frameWindow.encryptedTokenMetadata = encryptedTokenMetadata;
      // frameWindow.parsedConnectionString = "foo";
    }
  }, [ref, encryptedToken, encryptedTokenMetadata, isLoggedIn, databaseAccount]);

  return (
    <>
      <header>
        <div className="items" role="menubar">
          <div className="cosmosDBTitle">
            <span
              className="title"
              onClick={() => window.open("https://portal.azure.com", "_blank")}
              tabIndex={0}
              title="Go to Azure Portal"
            >
              Microsoft Azure
            </span>
            <span className="accontSplitter" /> <span className="serviceTitle">Cosmos DB</span>
            {(isLoggedIn || encryptedTokenMetadata?.accountName) && (
              <img className="chevronRight" src={ChevronRight} alt="account separator" />
            )}
            {isLoggedIn && (
              <span className="accountSwitchComponentContainer">
                <AccountSwitchComponent armToken={armToken} setDatabaseAccount={setDatabaseAccount} />
              </span>
            )}
            {!isLoggedIn && encryptedTokenMetadata?.accountName && (
              <span className="accountSwitchComponentContainer">
                <span className="accountNameHeader">{encryptedTokenMetadata?.accountName}</span>
              </span>
            )}
          </div>
          <FeedbackCommandButton />
          <div className="meControl">
            {isLoggedIn ? (
              <MeControl {...{ graphToken, openPanel, logout, account }} />
            ) : (
              <SignInButton {...{ login }} />
            )}
          </div>
        </div>
      </header>
      {databaseAccount && (
        // Ideally we would import and render data explorer like any other React component, however
        // because it still has a significant amount of Knockout code, this would lead to memory leaks.
        // Knockout does not have a way to tear down all of its binding and listeners with a single method.
        // It's possible this can be changed once all knockout code has been removed.
        <iframe
          // Setting key is needed so React will re-render this element on any account change
          key={databaseAccount.id}
          ref={ref}
          id="explorerMenu"
          name="explorer"
          className="iframe"
          title="explorer"
          src="explorer.html?v=1.0.1&platform=Hosted"
        ></iframe>
      )}
      {!isLoggedIn && !encryptedTokenMetadata && <ConnectExplorer {...{ login, setEncryptedToken }} />}
      <DirectoryPickerPanel {...{ isOpen, dismissPanel, armToken, tenantId }} />
    </>
  );
};

render(<App />, document.getElementById("App"));
