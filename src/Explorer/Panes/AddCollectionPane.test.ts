import * as Constants from "../../Common/Constants";
import * as ViewModels from "../../Contracts/ViewModels";
import AddCollectionPane from "./AddCollectionPane";
import Explorer from "../Explorer";
import ko from "knockout";
import { AutopilotTier } from "../../Contracts/DataModels";

describe("Add Collection Pane", () => {
  describe("isValid()", () => {
    let explorer: ViewModels.Explorer;
    const mockDatabaseAccount: ViewModels.DatabaseAccount = {
      id: "mock",
      kind: "DocumentDB",
      location: "",
      name: "mock",
      properties: undefined,
      type: undefined,
      tags: [],
    };

    beforeEach(() => {
      explorer = new Explorer({ documentClientUtility: null, notificationsClient: null, isEmulator: false });
      explorer.hasAutoPilotV2FeatureFlag = ko.computed<boolean>(() => true);
    });

    it("should be true if autopilot enabled and select valid tier", () => {
      explorer.databaseAccount(mockDatabaseAccount);
      const addCollectionPane = explorer.addCollectionPane as AddCollectionPane;
      addCollectionPane.hasAutoPilotV2FeatureFlag = ko.computed<boolean>(() => true);
      addCollectionPane.isAutoPilotSelected(true);
      addCollectionPane.selectedAutoPilotTier(AutopilotTier.Tier2);
      expect(addCollectionPane.isValid()).toBe(true);
    });

    it("should be false if autopilot enabled and select invalid tier", () => {
      explorer.databaseAccount(mockDatabaseAccount);
      const addCollectionPane = explorer.addCollectionPane as AddCollectionPane;
      addCollectionPane.hasAutoPilotV2FeatureFlag = ko.computed<boolean>(() => true);
      addCollectionPane.isAutoPilotSelected(true);
      addCollectionPane.selectedAutoPilotTier(0);
      expect(addCollectionPane.isValid()).toBe(false);
    });

    it("should be true if graph API and partition key is not /id nor /label", () => {
      explorer.defaultExperience(Constants.DefaultAccountExperience.Graph.toLowerCase());
      const addCollectionPane = explorer.addCollectionPane as AddCollectionPane;
      addCollectionPane.partitionKey("/blah");
      expect(addCollectionPane.isValid()).toBe(true);
    });

    it("should be false if graph API and partition key is /id or /label", () => {
      explorer.defaultExperience(Constants.DefaultAccountExperience.Graph.toLowerCase());
      const addCollectionPane = explorer.addCollectionPane as AddCollectionPane;
      addCollectionPane.partitionKey("/id");
      expect(addCollectionPane.isValid()).toBe(false);

      addCollectionPane.partitionKey("/label");
      expect(addCollectionPane.isValid()).toBe(false);
    });

    it("should be true for any non-graph API with /id or /label partition key", () => {
      explorer.defaultExperience(Constants.DefaultAccountExperience.DocumentDB.toLowerCase());
      const addCollectionPane = explorer.addCollectionPane as AddCollectionPane;

      addCollectionPane.partitionKey("/id");
      expect(addCollectionPane.isValid()).toBe(true);

      addCollectionPane.partitionKey("/label");
      expect(addCollectionPane.isValid()).toBe(true);
    });
  });
});
