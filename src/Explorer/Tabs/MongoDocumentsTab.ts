import * as Constants from "../../Common/Constants";
import * as DataModels from "../../Contracts/DataModels";
import * as ko from "knockout";
import * as ViewModels from "../../Contracts/ViewModels";
import DocumentId from "../Tree/DocumentId";
import DocumentsTab from "./DocumentsTab";
import * as ErrorParserUtility from "../../Common/ErrorParserUtility";
import MongoUtility from "../../Common/MongoUtility";
import ObjectId from "../Tree/ObjectId";
import Q from "q";
import TelemetryProcessor from "../../Shared/Telemetry/TelemetryProcessor";
import { Action } from "../../Shared/Telemetry/TelemetryConstants";
import {
  createDocument,
  deleteDocument,
  queryDocuments,
  readDocument,
  updateDocument,
} from "../../Common/MongoProxyClient";
import { extractPartitionKey } from "@azure/cosmos";
import * as Logger from "../../Common/Logger";
import { PartitionKeyDefinition } from "@azure/cosmos";

export default class MongoDocumentsTab extends DocumentsTab implements ViewModels.DocumentsTab {
  public collection: ViewModels.Collection;
  private continuationToken: string;

  constructor(options: ViewModels.DocumentsTabOptions) {
    super(options);
    this.lastFilterContents = ko.observableArray<string>(['{"id":"foo"}', "{ qty: { $gte: 20 } }"]);

    if (this.partitionKeyProperty && ~this.partitionKeyProperty.indexOf(`"`)) {
      this.partitionKeyProperty = this.partitionKeyProperty.replace(/["]+/g, "");
    }

    if (this.partitionKeyProperty && this.partitionKeyProperty.indexOf("$v") > -1) {
      // From $v.shard.$v.key.$v > shard.key
      this.partitionKeyProperty = this.partitionKeyProperty.replace(/.\$v/g, "").replace(/\$v./g, "");
      this.partitionKeyPropertyHeader = "/" + this.partitionKeyProperty;
    }

    this.isFilterExpanded = ko.observable<boolean>(true);
    super.buildCommandBarOptions.bind(this);
    super.buildCommandBarOptions();
  }

  public onSaveNewDocumentClick = (): Q.Promise<any> => {
    const documentContent = JSON.parse(this.selectedDocumentContent());
    this.displayedError("");
    const startKey: number = TelemetryProcessor.traceStart(Action.CreateDocument, {
      databaseAccountName: this.collection && this.collection.container.databaseAccount().name,
      defaultExperience: this.collection && this.collection.container.defaultExperience(),
      dataExplorerArea: Constants.Areas.Tab,
      tabTitle: this.tabTitle(),
    });

    if (
      this.partitionKeyProperty &&
      this.partitionKeyProperty !== "_id" &&
      !this._hasShardKeySpecified(documentContent)
    ) {
      const message = `The document is lacking the shard property: ${this.partitionKeyProperty}`;
      this.displayedError(message);
      let that = this;
      setTimeout(() => {
        that.displayedError("");
      }, Constants.ClientDefaults.errorNotificationTimeoutMs);
      this.isExecutionError(true);
      TelemetryProcessor.traceFailure(
        Action.CreateDocument,
        {
          databaseAccountName: this.collection && this.collection.container.databaseAccount().name,
          defaultExperience: this.collection && this.collection.container.defaultExperience(),
          dataExplorerArea: Constants.Areas.Tab,
          tabTitle: this.tabTitle(),
        },
        startKey
      );
      Logger.logError("Failed to save new document: Document shard key not defined", "MongoDocumentsTab");
      return Q.reject("Document without shard key");
    }

    this.isExecutionError(false);
    this.isExecuting(true);
    return Q(createDocument(this.collection.databaseId, this.collection, this.partitionKeyProperty, documentContent))
      .then(
        (savedDocument: any) => {
          let partitionKeyArray = extractPartitionKey(
            savedDocument,
            this._getPartitionKeyDefinition() as PartitionKeyDefinition
          );

          let partitionKeyValue = partitionKeyArray && partitionKeyArray[0];

          let id = new ObjectId(this, savedDocument, partitionKeyValue);
          let ids = this.documentIds();
          ids.push(id);
          delete savedDocument._self;

          let value: string = this.renderObjectForEditor(savedDocument || {}, null, 4);
          this.selectedDocumentContent.setBaseline(value);

          this.selectedDocumentId(id);
          this.documentIds(ids);
          this.editorState(ViewModels.DocumentExplorerState.exisitingDocumentNoEdits);
          TelemetryProcessor.traceSuccess(
            Action.CreateDocument,
            {
              databaseAccountName: this.collection && this.collection.container.databaseAccount().name,
              defaultExperience: this.collection && this.collection.container.defaultExperience(),
              dataExplorerArea: Constants.Areas.Tab,
              tabTitle: this.tabTitle(),
            },
            startKey
          );
        },
        (reason) => {
          this.isExecutionError(true);
          const message = ErrorParserUtility.parse(reason)[0].message;
          window.alert(message);
          TelemetryProcessor.traceFailure(
            Action.CreateDocument,
            {
              databaseAccountName: this.collection && this.collection.container.databaseAccount().name,
              defaultExperience: this.collection && this.collection.container.defaultExperience(),
              dataExplorerArea: Constants.Areas.Tab,
              tabTitle: this.tabTitle(),
            },
            startKey
          );
        }
      )
      .finally(() => this.isExecuting(false));
  };

  public onSaveExisitingDocumentClick = (): Q.Promise<any> => {
    const selectedDocumentId = this.selectedDocumentId();
    const documentContent = this.selectedDocumentContent();
    this.isExecutionError(false);
    this.isExecuting(true);
    const startKey: number = TelemetryProcessor.traceStart(Action.UpdateDocument, {
      databaseAccountName: this.collection && this.collection.container.databaseAccount().name,
      defaultExperience: this.collection && this.collection.container.defaultExperience(),
      dataExplorerArea: Constants.Areas.Tab,
      tabTitle: this.tabTitle(),
    });

    return Q(updateDocument(this.collection.databaseId, this.collection, selectedDocumentId, documentContent))
      .then(
        (updatedDocument: any) => {
          let value: string = this.renderObjectForEditor(updatedDocument || {}, null, 4);
          this.selectedDocumentContent.setBaseline(value);

          this.documentIds().forEach((documentId: ViewModels.DocumentId) => {
            if (documentId.rid === updatedDocument._rid) {
              const partitionKeyArray = extractPartitionKey(
                updatedDocument,
                this._getPartitionKeyDefinition() as PartitionKeyDefinition
              );

              let partitionKeyValue = partitionKeyArray && partitionKeyArray[0];

              const id = new ObjectId(this, updatedDocument, partitionKeyValue);
              documentId.id(id.id());
            }
          });
          this.editorState(ViewModels.DocumentExplorerState.exisitingDocumentNoEdits);
          TelemetryProcessor.traceSuccess(
            Action.UpdateDocument,
            {
              databaseAccountName: this.collection && this.collection.container.databaseAccount().name,
              defaultExperience: this.collection && this.collection.container.defaultExperience(),
              dataExplorerArea: Constants.Areas.Tab,
              tabTitle: this.tabTitle(),
            },
            startKey
          );
        },
        (reason) => {
          this.isExecutionError(true);
          const message = ErrorParserUtility.parse(reason)[0].message;
          window.alert(message);
          TelemetryProcessor.traceFailure(
            Action.UpdateDocument,
            {
              databaseAccountName: this.collection && this.collection.container.databaseAccount().name,
              defaultExperience: this.collection && this.collection.container.defaultExperience(),
              dataExplorerArea: Constants.Areas.Tab,
              tabTitle: this.tabTitle(),
            },
            startKey
          );
        }
      )
      .finally(() => this.isExecuting(false));
  };

  public buildQuery(filter: string): string {
    return filter || "{}";
  }

  public selectDocument(documentId: ViewModels.DocumentId): Q.Promise<any> {
    this.selectedDocumentId(documentId);
    return Q(
      readDocument(this.collection.databaseId, this.collection, documentId).then((content: any) => {
        this.initDocumentEditor(documentId, content);
      })
    );
  }

  public loadNextPage(): Q.Promise<any> {
    this.isExecuting(true);
    this.isExecutionError(false);
    const filter: string = this.filterContent().trim();
    const query: string = this.buildQuery(filter);

    return Q(queryDocuments(this.collection.databaseId, this.collection, true, query, this.continuationToken))
      .then(
        ({ continuationToken, documents }) => {
          this.continuationToken = continuationToken;
          let currentDocuments = this.documentIds();
          const currentDocumentsRids = currentDocuments.map((currentDocument) => currentDocument.rid);
          const nextDocumentIds = documents
            .filter((d: any) => {
              return currentDocumentsRids.indexOf(d._rid) < 0;
            })
            .map((rawDocument: any) => {
              const partitionKeyValue = rawDocument._partitionKeyValue;
              return <ViewModels.DocumentId>new DocumentId(this, rawDocument, partitionKeyValue);
            });

          const merged = currentDocuments.concat(nextDocumentIds);

          this.documentIds(merged);
          currentDocuments = this.documentIds();
          if (this.filterContent().length > 0 && currentDocuments.length > 0) {
            currentDocuments[0].click();
          } else {
            this.selectedDocumentContent("");
            this.selectedDocumentId(null);
            this.editorState(ViewModels.DocumentExplorerState.noDocumentSelected);
          }
          if (this.onLoadStartKey != null && this.onLoadStartKey != undefined) {
            TelemetryProcessor.traceSuccess(
              Action.Tab,
              {
                databaseAccountName: this.collection.container.databaseAccount().name,
                databaseName: this.collection.databaseId,
                collectionName: this.collection.id(),
                defaultExperience: this.collection.container.defaultExperience(),
                dataExplorerArea: Constants.Areas.Tab,
                tabTitle: this.tabTitle(),
              },
              this.onLoadStartKey
            );
            this.onLoadStartKey = null;
          }
        },
        (error: any) => {
          if (this.onLoadStartKey != null && this.onLoadStartKey != undefined) {
            TelemetryProcessor.traceFailure(
              Action.Tab,
              {
                databaseAccountName: this.collection.container.databaseAccount().name,
                databaseName: this.collection.databaseId,
                collectionName: this.collection.id(),
                defaultExperience: this.collection.container.defaultExperience(),
                dataExplorerArea: Constants.Areas.Tab,
                tabTitle: this.tabTitle(),
                error: error,
              },
              this.onLoadStartKey
            );
            this.onLoadStartKey = null;
          }
        }
      )
      .finally(() => this.isExecuting(false));
  }

  protected _onEditorContentChange(newContent: string) {
    try {
      if (
        this.editorState() === ViewModels.DocumentExplorerState.newDocumentValid ||
        this.editorState() === ViewModels.DocumentExplorerState.newDocumentInvalid
      ) {
        let parsed: any = JSON.parse(newContent);
      }

      // Mongo uses BSON format for _id, trying to parse it as JSON blocks normal flow in an edit
      this.onValidDocumentEdit();
    } catch (e) {
      this.onInvalidDocumentEdit();
    }
  }

  /** Renders a Javascript object to be displayed inside Monaco Editor */
  protected renderObjectForEditor(value: any, replacer: any, space: string | number): string {
    return MongoUtility.tojson(value, null, false);
  }

  private _hasShardKeySpecified(document: any): boolean {
    return Boolean(extractPartitionKey(document, this._getPartitionKeyDefinition() as PartitionKeyDefinition));
  }

  private _getPartitionKeyDefinition(): DataModels.PartitionKey {
    let partitionKey: DataModels.PartitionKey = this.partitionKey;

    if (
      this.partitionKey &&
      this.partitionKey.paths &&
      this.partitionKey.paths.length &&
      this.partitionKey.paths.length > 0 &&
      this.partitionKey.paths[0].indexOf("$v") > -1
    ) {
      // Convert BsonSchema2 to /path format
      partitionKey = {
        kind: partitionKey.kind,
        paths: ["/" + this.partitionKeyProperty.replace(/\./g, "/")],
        version: partitionKey.version,
      };
    }

    return partitionKey;
  }

  protected __deleteDocument(documentId: ViewModels.DocumentId): Q.Promise<any> {
    return Q(deleteDocument(this.collection.databaseId, this.collection, documentId));
  }
}
