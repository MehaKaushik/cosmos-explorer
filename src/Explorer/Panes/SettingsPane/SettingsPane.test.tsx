import { DatabaseAccount } from "Contracts/DataModels";
import { shallow } from "enzyme";
import React from "react";
import { updateUserContext } from "UserContext";
import Explorer from "../../Explorer";
import { SettingsPane } from "./SettingsPane";
const props = {
  explorer: new Explorer(),
  closePanel: (): void => undefined,
};
describe("Settings Pane", () => {
  it("should render Default properly", () => {
    const wrapper = shallow(<SettingsPane {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("should render Gremlin properly", () => {
    updateUserContext({
      databaseAccount: {
        properties: {
          capabilities: [{ name: "EnableGremlin" }],
        },
      } as DatabaseAccount,
    });
    const wrapper = shallow(<SettingsPane {...props} />);
    expect(wrapper).toMatchSnapshot();
  });
});
