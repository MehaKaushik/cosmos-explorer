import { StoredProcedureDefinition } from "@azure/cosmos";
import * as ko from "knockout";
import * as Constants from "../../Common/Constants";
import { deleteTrigger } from "../../Common/dataAccess/deleteTrigger";
import * as ViewModels from "../../Contracts/ViewModels";
import { useTabs } from "../../hooks/useTabs";
import { Action, ActionModifiers } from "../../Shared/Telemetry/TelemetryConstants";
import * as TelemetryProcessor from "../../Shared/Telemetry/TelemetryProcessor";
import Explorer from "../Explorer";
import TriggerTab from "../Tabs/TriggerTab";
import { useSelectedNode } from "../useSelectedNode";

export default class Trigger {
  public nodeKind: string;
  public container: Explorer;
  public collection: ViewModels.Collection;
  public self: string;
  public rid: string;
  public id: ko.Observable<string>;
  public body: ko.Observable<string>;
  public triggerType: ko.Observable<string>;
  public triggerOperation: ko.Observable<string>;

  constructor(container: Explorer, collection: ViewModels.Collection, data: any) {
    this.nodeKind = "Trigger";
    this.container = container;
    this.collection = collection;
    this.self = data._self;
    this.rid = data._rid;
    this.id = ko.observable(data.id);
    this.body = ko.observable(data.body);
    this.triggerOperation = ko.observable(data.triggerOperation);
    this.triggerType = ko.observable(data.triggerType);
  }

  public select() {
    useSelectedNode.getState().setSelectedNode(this);
    TelemetryProcessor.trace(Action.SelectItem, ActionModifiers.Mark, {
      description: "Trigger node",

      dataExplorerArea: Constants.Areas.ResourceTree,
    });
  }

  public static create(source: ViewModels.Collection, event: MouseEvent) {
    const id = useTabs.getState().getTabs(ViewModels.CollectionTabKind.Triggers).length + 1;
    const trigger = <StoredProcedureDefinition>{
      id: "",
      body: "function trigger(){}",
      triggerOperation: "All",
      triggerType: "Pre",
    };

    const triggerTab: TriggerTab = new TriggerTab({
      resource: trigger,
      isNew: true,
      tabKind: ViewModels.CollectionTabKind.Triggers,
      title: `New Trigger ${id}`,
      tabPath: "",
      collection: source,
      node: source,
    });

    useTabs.getState().activateNewTab(triggerTab);
  }

  public open = () => {
    this.select();

    const triggerTabs: TriggerTab[] = useTabs
      .getState()
      .getTabs(ViewModels.CollectionTabKind.Triggers, (tab) => tab.node && tab.node.rid === this.rid) as TriggerTab[];
    let triggerTab: TriggerTab = triggerTabs && triggerTabs[0];

    if (triggerTab) {
      useTabs.getState().activateTab(triggerTab);
    } else {
      const triggerData = <StoredProcedureDefinition>{
        _rid: this.rid,
        _self: this.self,
        id: this.id(),
        body: this.body(),
        triggerOperation: this.triggerOperation(),
        triggerType: this.triggerType(),
      };

      triggerTab = new TriggerTab({
        resource: triggerData,
        isNew: false,
        tabKind: ViewModels.CollectionTabKind.Triggers,
        title: triggerData.id,
        tabPath: "",
        collection: this.collection,
        node: this,
      });

      useTabs.getState().activateNewTab(triggerTab);
    }
  };

  public delete() {
    if (!window.confirm("Are you sure you want to delete the trigger?")) {
      return;
    }

    deleteTrigger(this.collection.databaseId, this.collection.id(), this.id()).then(
      () => {
        useTabs.getState().closeTabsByComparator((tab) => tab.node && tab.node.rid === this.rid);
        this.collection.children.remove(this);
      },
      (reason) => {}
    );
  }
}
