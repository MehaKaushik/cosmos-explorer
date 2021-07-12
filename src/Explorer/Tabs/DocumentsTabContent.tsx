import { extractPartitionKey, PartitionKeyDefinition } from "@azure/cosmos";
import {
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  IIconProps,
  Image,
  List,
  PrimaryButton,
  SelectionMode,
  Stack,
  Text,
  TextField,
} from "@fluentui/react";
import * as React from "react";
import SplitterLayout from "react-splitter-layout";
import CloseIcon from "../../../images/close-black.svg";
import DeleteDocumentIcon from "../../../images/DeleteDocument.svg";
import DiscardIcon from "../../../images/discard.svg";
import DocumentWaterMark from "../../../images/DocumentWaterMark.svg";
import NewDocumentIcon from "../../../images/NewDocument.svg";
import SaveIcon from "../../../images/save-cosmos.svg";
import UploadIcon from "../../../images/Upload_16x16.svg";
import { Resource } from "../../../src/Contracts/DataModels";
import { Areas } from "../../Common/Constants";
import { createDocument as createSqlDocuments } from "../../Common/dataAccess/createDocument";
import { deleteDocument as deleteSqlDocument } from "../../Common/dataAccess/deleteDocument";
import { queryDocuments as querySqlDocuments } from "../../Common/dataAccess/queryDocuments";
import { updateDocument as updateSqlDocuments } from "../../Common/dataAccess/updateDocument";
import { getErrorMessage, getErrorStack } from "../../Common/ErrorHandlingUtils";
import * as HeadersUtility from "../../Common/HeadersUtility";
import { logError } from "../../Common/Logger";
import { createDocument, deleteDocument, queryDocuments, updateDocument } from "../../Common/MongoProxyClient";
import * as ViewModels from "../../Contracts/ViewModels";
import { Action } from "../../Shared/Telemetry/TelemetryConstants";
import * as TelemetryProcessor from "../../Shared/Telemetry/TelemetryProcessor";
import { userContext } from "../../UserContext";
import * as QueryUtils from "../../Utils/QueryUtils";
import { CommandButtonComponentProps } from "../Controls/CommandButton/CommandButtonComponent";
import { EditorReact } from "../Controls/Editor/EditorReact";
import { useCommandBar } from "../Menus/CommandBar/CommandBarComponentAdapter";
import DocumentId from "../Tree/DocumentId";
import ObjectId from "../Tree/ObjectId";
import { useSelectedNode } from "../useSelectedNode";
import DocumentsTab from "./DocumentsTab";
import {
  formatDocumentContent,
  formatSqlDocumentContent,
  getConfirmationMessage,
  getDocumentItems,
  getFilterPlaceholder,
  getFilterSuggestions,
  getfilterText,
  getPartitionKeyDefinition,
  hasShardKeySpecified,
  IButton,
  IDocumentsTabContentState,
  imageProps,
  tabButtonVisibility,
} from "./DocumentTabUtils";

const filterIcon: IIconProps = { iconName: "Filter" };

export default class DocumentsTabContent extends React.Component<DocumentsTab, IDocumentsTabContentState> {
  public newDocumentButton: IButton;
  public saveNewDocumentButton: IButton;
  public discardNewDocumentChangesButton: IButton;
  public saveExisitingDocumentButton: IButton;
  public discardExisitingDocumentChangesButton: IButton;
  public deleteExisitingDocumentButton: IButton;
  public intitalDocumentContent: string;

  constructor(props: DocumentsTab) {
    super(props);

    this.newDocumentButton = tabButtonVisibility(true, true);
    this.saveNewDocumentButton = tabButtonVisibility(false, true);
    this.discardNewDocumentChangesButton = tabButtonVisibility(false, false);
    this.saveExisitingDocumentButton = tabButtonVisibility(false, false);
    this.discardExisitingDocumentChangesButton = tabButtonVisibility(false, false);
    this.deleteExisitingDocumentButton = tabButtonVisibility(false, false);
    const isPreferredApiMongoDB = userContext.apiType === "Mongo";

    const columns: IColumn[] = [
      {
        key: "_id",
        name: isPreferredApiMongoDB ? "_id" : "id",
        minWidth: 90,
        maxWidth: 140,
        isResizable: true,
        isCollapsible: true,
        data: "string",
        onRender: (item: DocumentId) => {
          return (
            <div onClick={() => this.handleRow(item)} className="documentIdItem">
              {isPreferredApiMongoDB ? item.id() : item.id}
            </div>
          );
        },
        isPadded: true,
      },
      {
        key: "column2",
        name: props.partitionKeyPropertyHeader,
        minWidth: 50,
        maxWidth: 60,
        isResizable: true,
        isCollapsible: true,
        data: "number",
        onRender: (item: DocumentId) => {
          return (
            <div onClick={() => this.handleRow(item)} className="documentIdItem">
              {isPreferredApiMongoDB ? item.partitionKeyValue : item._partitionKeyValue}
            </div>
          );
        },
      },
    ];

    this.intitalDocumentContent = `{ \n ${
      isPreferredApiMongoDB ? '"_id"' : '"id"'
    }: "replace_with_new_document_id" \n }`;

    this.state = {
      columns: columns,
      isModalSelection: false,
      isCompactMode: false,
      announcedMessage: undefined,
      isSuggestionVisible: false,
      filter: "",
      isFilterOptionVisible: true,
      isEditorVisible: false,
      documentContent: this.intitalDocumentContent,
      documentIds: [],
      documentSqlIds: [],
      editorKey: "",
      isEditorContentEdited: false,
      isAllDocumentsVisible: false,
    };
  }

  componentDidMount(): void {
    this.props.isExecuting(true);
    this.updateTabButton();
    if (userContext.apiType === "Mongo") {
      this.queryDocumentsData();
    } else {
      this.querySqlDocumentsData();
    }
  }

  public buildQuery(filter: string): string {
    return QueryUtils.buildDocumentsQuery(filter, this.props.partitionKeyProperty, this.props.partitionKey);
  }

  private querySqlDocumentsData = async (): Promise<void> => {
    this.props.isExecuting(true);
    this.props.isExecutionError(false);
    const { filter } = this.state;
    const query: string = this.buildQuery(filter);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {};
    options.enableCrossPartitionQuery = HeadersUtility.shouldEnableCrossPartitionKey();
    if (this.props._resourceTokenPartitionKey) {
      options.partitionKey = this.props._resourceTokenPartitionKey;
    }

    try {
      const sqlQuery = querySqlDocuments(this.props.collection.databaseId, this.props.collection.id(), query, options);
      const querySqlDocumentsData = await sqlQuery.fetchNext();
      this.setState({ documentSqlIds: querySqlDocumentsData.resources.length ? querySqlDocumentsData.resources : [] });
      this.props.isExecuting(false);
    } catch (error) {
      this.props.isExecuting(false);
      this.props.isExecutionError(true);
      const errorMessage = getErrorMessage(error);
      window.alert(errorMessage);
    }
  };

  private queryDocumentsData = async (): Promise<void> => {
    this.props.isExecuting(true);
    this.props.isExecutionError(false);
    try {
      const { filter } = this.state;
      const query: string = filter || "{}";
      const queryDocumentsData = await queryDocuments(
        this.props.collection.databaseId,
        this.props.collection as ViewModels.Collection,
        true,
        query,
        undefined
      );
      if (queryDocumentsData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nextDocumentIds = queryDocumentsData.documents.map((rawDocument: any) => {
          const partitionKeyValue = rawDocument._partitionKeyValue;
          return new DocumentId(this.props as DocumentsTab, rawDocument, partitionKeyValue);
        });
        this.setState({ documentIds: nextDocumentIds });
      }
      if (this.props.onLoadStartKey !== undefined) {
        TelemetryProcessor.traceSuccess(
          Action.Tab,
          {
            databaseName: this.props.collection.databaseId,
            collectionName: this.props.collection.id(),
            dataExplorerArea: Areas.Tab,
            tabTitle: this.props.tabTitle(),
          },
          this.props.onLoadStartKey
        );
      }
      this.props.isExecuting(false);
    } catch (error) {
      if (this.props.onLoadStartKey !== undefined) {
        TelemetryProcessor.traceFailure(
          Action.Tab,
          {
            databaseName: this.props.collection.databaseId,
            collectionName: this.props.collection.id(),
            dataExplorerArea: Areas.Tab,
            tabTitle: this.props.tabTitle(),
            error: getErrorMessage(error),
            errorStack: getErrorStack(error),
          },
          this.props.onLoadStartKey
        );
      }
      this.props.isExecuting(false);
    }
  };

  private handleRow = (row: DocumentId | Resource): void => {
    if (this.state.isEditorContentEdited) {
      const isChangesConfirmed = window.confirm("Your unsaved changes will be lost.");
      if (isChangesConfirmed) {
        this.handleRowContent(row);
        this.setState({ isEditorContentEdited: false });
        return;
      }
    } else {
      this.handleRowContent(row);
    }
  };

  private handleRowContent = (row: DocumentId | Resource): void => {
    const formattedDocumentContent =
      userContext.apiType === "Mongo"
        ? formatDocumentContent(row as DocumentId)
        : formatSqlDocumentContent(row as Resource);
    this.updateTabButtonVisibility();

    userContext.apiType === "Mongo"
      ? this.updateContent(row as DocumentId, formattedDocumentContent)
      : this.updateSqlContent(row as Resource, formattedDocumentContent);
  };

  private updateContent = (row: DocumentId, formattedDocumentContent: string): void => {
    this.setState(
      {
        documentContent: formattedDocumentContent,
        isEditorVisible: true,
        editorKey: row.rid,
        selectedDocumentId: row,
      },
      () => {
        this.updateTabButton();
      }
    );
  };

  private updateSqlContent = (row: Resource, formattedDocumentContent: string): void => {
    this.setState(
      {
        documentContent: formattedDocumentContent,
        isEditorVisible: true,
        editorKey: row._rid,
        selectedSqlDocumentId: row,
      },
      () => {
        this.updateTabButton();
      }
    );
  };

  private handleFilter = (): void => {
    userContext.apiType === "Mongo" ? this.queryDocumentsData() : this.querySqlDocumentsData();
    this.setState({
      isSuggestionVisible: false,
    });
  };

  async updateSqlDocument(): Promise<void> {
    const { partitionKey, partitionKeyProperty, isExecutionError, isExecuting, collection } = this.props;
    const { documentContent } = this.state;
    const partitionKeyArray = extractPartitionKey(
      this.state.selectedSqlDocumentId,
      getPartitionKeyDefinition(partitionKey, partitionKeyProperty) as PartitionKeyDefinition
    );

    const partitionKeyValue = partitionKeyArray && partitionKeyArray[0];
    const selectedDocumentId = new DocumentId(
      this.props as DocumentsTab,
      this.state.selectedSqlDocumentId,
      partitionKeyValue
    );
    isExecutionError(false);
    const startKey: number = this.getStartKey(Action.UpdateDocument);
    try {
      isExecuting(true);
      const updateSqlDocumentRes = await updateSqlDocuments(
        collection as ViewModels.Collection,
        selectedDocumentId,
        JSON.parse(documentContent)
      );
      if (updateSqlDocumentRes) {
        this.setTraceSuccess(Action.UpdateDocument, startKey);
        this.querySqlDocumentsData();
      }
    } catch (error) {
      window.alert(getErrorMessage(error));
      this.setTraceFail(Action.UpdateDocument, startKey, error);
    }
  }

  private async updateMongoDocument(): Promise<void> {
    const { selectedDocumentId, documentContent, documentIds } = this.state;
    const { isExecutionError, isExecuting, collection, partitionKey, partitionKeyProperty } = this.props;
    isExecutionError(false);
    isExecuting(true);
    const startKey: number = this.getStartKey(Action.UpdateDocument);
    try {
      const updatedDocument = await updateDocument(
        collection.databaseId,
        collection as ViewModels.Collection,
        selectedDocumentId,
        documentContent
      );

      documentIds.forEach((documentId: DocumentId) => {
        if (documentId.rid === updatedDocument._rid) {
          const partitionKeyArray = extractPartitionKey(
            updatedDocument,
            getPartitionKeyDefinition(partitionKey, partitionKeyProperty) as PartitionKeyDefinition
          );
          const partitionKeyValue = partitionKeyArray && partitionKeyArray[0];
          const id = new ObjectId(this.props as DocumentsTab, updatedDocument, partitionKeyValue);
          documentId.id(id.id());
        }
      });
      this.setTraceSuccess(Action.UpdateDocument, startKey);
      this.setState({ isEditorContentEdited: false });
    } catch (error) {
      window.alert(getErrorMessage(error));
      this.setTraceFail(Action.UpdateDocument, startKey, error);
    }
  }

  protected getTabsButtons(): CommandButtonComponentProps[] {
    const buttons: CommandButtonComponentProps[] = [];
    const label = userContext.apiType === "Mongo" ? "New Document" : "New Item";
    if (this.newDocumentButton.visible) {
      buttons.push({
        iconSrc: NewDocumentIcon,
        iconAlt: label,
        onCommandClick: this.onNewDocumentClick,
        commandButtonLabel: label,
        ariaLabel: label,
        hasPopup: false,
        disabled: !this.newDocumentButton.enabled,
      });
    }

    if (this.saveNewDocumentButton.visible) {
      const label = "Save";
      buttons.push({
        iconSrc: SaveIcon,
        iconAlt: label,
        onCommandClick: this.onSaveNewDocumentClick,
        commandButtonLabel: label,
        ariaLabel: label,
        hasPopup: false,
        disabled: !this.saveNewDocumentButton.enabled,
      });
    }

    if (this.discardNewDocumentChangesButton.visible) {
      const label = "Discard";
      buttons.push({
        iconSrc: DiscardIcon,
        iconAlt: label,
        onCommandClick: this.onRevertNewDocumentClick,
        commandButtonLabel: label,
        ariaLabel: label,
        hasPopup: false,
        disabled: !this.discardNewDocumentChangesButton.enabled,
      });
    }

    if (this.saveExisitingDocumentButton.visible) {
      const label = "Update";
      buttons.push({
        ...this,
        updateMongoDocument: this.updateMongoDocument,
        updateSqlDocument: this.updateSqlDocument,
        setState: this.setState,
        iconSrc: SaveIcon,
        iconAlt: label,
        onCommandClick: this.onSaveExisitingDocumentClick,
        commandButtonLabel: label,
        ariaLabel: label,
        hasPopup: false,
        disabled: !this.saveExisitingDocumentButton.enabled,
      });
    }

    if (this.discardExisitingDocumentChangesButton.visible) {
      const label = "Discard";
      buttons.push({
        ...this,
        setState: this.setState,
        iconSrc: DiscardIcon,
        iconAlt: label,
        onCommandClick: this.onRevertExisitingDocumentClick,
        commandButtonLabel: label,
        ariaLabel: label,
        hasPopup: false,
        disabled: !this.discardExisitingDocumentChangesButton.enabled,
      });
    }

    if (this.deleteExisitingDocumentButton.visible) {
      const label = "Delete";
      buttons.push({
        ...this,
        setState: this.setState,
        iconSrc: DeleteDocumentIcon,
        iconAlt: label,
        onCommandClick: this.onDeleteExisitingDocumentClick,
        commandButtonLabel: label,
        ariaLabel: label,
        hasPopup: false,
        disabled: !this.deleteExisitingDocumentButton.enabled,
      });
    }
    if (userContext.apiType !== "Mongo") {
      const { collection } = this.props;
      const label = "Upload Item";
      buttons.push({
        iconSrc: UploadIcon,
        iconAlt: label,
        onCommandClick: () => {
          const selectedCollection: ViewModels.Collection = useSelectedNode.getState().findSelectedCollection();
          selectedCollection && collection.container.openUploadItemsPanePane();
        },
        commandButtonLabel: label,
        ariaLabel: label,
        hasPopup: true,
        disabled: useSelectedNode.getState().isDatabaseNodeOrNoneSelected(),
      });
    }
    return buttons;
  }

  private onSaveExisitingDocumentClick(): void {
    userContext.apiType === "Mongo" ? this.updateMongoDocument() : this.updateSqlDocument();
  }

  private async onDeleteExisitingDocumentClick(): Promise<void> {
    const confirmationMessage = getConfirmationMessage(userContext.apiType);
    const { isExecuting, collection, partitionKey, partitionKeyProperty } = this.props;
    const startKey: number = this.getStartKey(Action.DeleteDocument);
    if (window.confirm(confirmationMessage)) {
      try {
        isExecuting(true);
        if (userContext.apiType === "Mongo") {
          await deleteDocument(
            collection.databaseId,
            collection as ViewModels.Collection,
            this.state.selectedDocumentId
          );
          this.queryDocumentsData();
        } else {
          const partitionKeyArray = extractPartitionKey(
            this.state.selectedSqlDocumentId,
            getPartitionKeyDefinition(partitionKey, partitionKeyProperty) as PartitionKeyDefinition
          );
          const partitionKeyValue = partitionKeyArray && partitionKeyArray[0];
          const selectedDocumentId = new DocumentId(
            this.props as DocumentsTab,
            this.state.selectedSqlDocumentId,
            partitionKeyValue
          );
          await deleteSqlDocument(collection as ViewModels.Collection, selectedDocumentId);
          this.querySqlDocumentsData();
        }
        this.setTraceSuccess(Action.DeleteDocument, startKey);
        this.setState({ isEditorVisible: false });
      } catch (error) {
        this.setTraceFail(Action.DeleteDocument, startKey, error);
      }
    }
  }

  private onRevertExisitingDocumentClick(): void {
    const { selectedDocumentId, selectedSqlDocumentId } = this.state;
    const documentContent =
      userContext.apiType === "Mongo"
        ? formatDocumentContent(selectedDocumentId)
        : formatSqlDocumentContent(selectedSqlDocumentId);
    this.setState({
      documentContent: documentContent,
      editorKey: Math.random().toString(),
    });
  }

  private onNewDocumentClick = () => {
    this.newDocumentButton = tabButtonVisibility(true, false);
    this.saveNewDocumentButton = tabButtonVisibility(true, true);
    this.discardNewDocumentChangesButton = tabButtonVisibility(true, true);
    this.saveExisitingDocumentButton = tabButtonVisibility(false, false);
    this.discardExisitingDocumentChangesButton = tabButtonVisibility(false, false);
    this.deleteExisitingDocumentButton = tabButtonVisibility(false, false);

    this.updateTabButton();
    this.setState({
      documentContent: this.intitalDocumentContent,
      isEditorVisible: true,
      editorKey: this.intitalDocumentContent,
    });
  };

  private onSaveNewDocumentClick = () => {
    if (userContext.apiType === "Mongo") {
      this.onSaveNewMongoDocumentClick();
    } else {
      this.onSaveSqlNewMongoDocumentClick();
    }
  };

  public onSaveSqlNewMongoDocumentClick = async (): Promise<void> => {
    const { isExecutionError, isExecuting, collection } = this.props;
    isExecutionError(false);
    const startKey: number = this.getStartKey(Action.CreateDocument);
    const document = JSON.parse(this.state.documentContent);
    isExecuting(true);
    try {
      const savedDocument = await createSqlDocuments(collection, document);
      if (savedDocument) {
        this.handleRowContent(savedDocument as Resource);
        this.updateTabButtonVisibility();
        this.setTraceSuccess(Action.CreateDocument, startKey);
      }
      this.querySqlDocumentsData();
    } catch (error) {
      window.alert(getErrorMessage(error));
      this.setTraceFail(Action.CreateDocument, startKey, error);
    }
  };

  private updateTabButtonVisibility = (): void => {
    this.newDocumentButton = tabButtonVisibility(true, true);
    this.saveNewDocumentButton = tabButtonVisibility(false, false);
    this.discardNewDocumentChangesButton = tabButtonVisibility(false, false);
    this.saveExisitingDocumentButton = tabButtonVisibility(true, false);
    this.discardExisitingDocumentChangesButton = tabButtonVisibility(true, false);
    this.deleteExisitingDocumentButton = tabButtonVisibility(true, true);
    this.updateTabButton();
  };

  public onSaveNewMongoDocumentClick = async (): Promise<void> => {
    const parsedDocumentContent = JSON.parse(this.state.documentContent);
    const {
      partitionKey,
      partitionKeyProperty,
      displayedError,
      isExecutionError,
      isExecuting,
      collection,
    } = this.props;
    displayedError("");
    const startKey: number = this.getStartKey(Action.CreateDocument);
    if (
      partitionKeyProperty &&
      partitionKeyProperty !== "_id" &&
      !hasShardKeySpecified(parsedDocumentContent, partitionKey, partitionKeyProperty)
    ) {
      const message = `The document is lacking the shard property: ${partitionKeyProperty}`;
      displayedError(message);
      this.setTraceFail(Action.CreateDocument, startKey, message);
      logError("Failed to save new document: Document shard key not defined", "MongoDocumentsTab");
      throw new Error("Document without shard key");
    }
    isExecutionError(false);
    isExecuting(true);
    try {
      const savedDocument = await createDocument(
        collection.databaseId,
        collection as ViewModels.Collection,
        partitionKeyProperty,
        parsedDocumentContent
      );
      if (savedDocument) {
        this.handleLoadMoreDocument();
        this.updateTabButtonVisibility();
        this.setTraceSuccess(Action.CreateDocument, startKey);
      }
      this.setState({ isEditorContentEdited: false });
      this.queryDocumentsData();
    } catch (error) {
      window.alert(getErrorMessage(error));
      this.setTraceFail(Action.CreateDocument, startKey, error);
    }
  };

  private getStartKey = (action: number): number => {
    const startKey: number = TelemetryProcessor.traceStart(action, {
      dataExplorerArea: Areas.Tab,
      tabTitle: this.props.tabTitle(),
    });
    return startKey;
  };

  private setTraceSuccess = (action: number, startKey: number): void => {
    const { isExecuting, tabTitle } = this.props;
    TelemetryProcessor.traceSuccess(
      action,
      {
        dataExplorerArea: Areas.Tab,
        tabTitle: tabTitle(),
      },
      startKey
    );
    isExecuting(false);
  };

  private setTraceFail = (action: number, startKey: number, error: Error | string): void => {
    const { isExecuting, tabTitle, isExecutionError } = this.props;
    TelemetryProcessor.traceFailure(
      action,
      {
        dataExplorerArea: Areas.Tab,
        tabTitle: tabTitle(),
        error: getErrorMessage(error),
        errorStack: getErrorStack(error),
      },
      startKey
    );
    isExecuting(false);
    isExecutionError(true);
  };

  private onRevertNewDocumentClick = () => {
    this.newDocumentButton = tabButtonVisibility(true, true);
    this.saveNewDocumentButton = tabButtonVisibility(true, false);
    this.discardNewDocumentChangesButton = tabButtonVisibility(true, false);

    this.updateTabButton();
    this.setState({
      isEditorVisible: false,
      isEditorContentEdited: false,
    });
  };

  private onRenderCell = (item: { value: string }): JSX.Element => {
    return (
      <div
        className="documentTabSuggestions"
        onClick={() =>
          this.setState({
            filter: item.value,
            isSuggestionVisible: false,
          })
        }
      >
        <Text>{item.value}</Text>
      </div>
    );
  };

  private handleLoadMoreDocument = (): void => {
    userContext.apiType === "Mongo" ? this.queryDocumentsData() : this.querySqlDocumentsData();
    this.setState({
      isSuggestionVisible: false,
      isAllDocumentsVisible: true,
    });
  };

  private updateTabButton = (): void => {
    useCommandBar.getState().setContextButtons(this.getTabsButtons());
  };

  private getKey(item: DocumentId): string {
    return item.rid;
  }

  private handleDocumentContentChange = (newContent: string): void => {
    if (this.saveExisitingDocumentButton.visible) {
      this.saveExisitingDocumentButton = tabButtonVisibility(true, true);
      this.discardExisitingDocumentChangesButton = tabButtonVisibility(true, true);
    }

    this.setState(
      {
        documentContent: newContent,
        isEditorContentEdited: true,
      },
      () => {
        this.updateTabButton();
      }
    );
  };

  public render(): JSX.Element {
    const {
      columns,
      isCompactMode,
      isSuggestionVisible,
      filter,
      isFilterOptionVisible,
      isEditorVisible,
      documentContent,
      documentIds,
      documentSqlIds,
      editorKey,
      isAllDocumentsVisible,
    } = this.state;

    const isPreferredApiMongoDB = userContext.apiType === "Mongo";

    return (
      <div>
        {isFilterOptionVisible && (
          <div>
            <div>
              <Stack horizontal verticalFill wrap>
                {!isPreferredApiMongoDB && <Text className="queryText">SELECT * FROM c</Text>}
                <TextField
                  iconProps={filterIcon}
                  placeholder={getFilterPlaceholder(isPreferredApiMongoDB)}
                  className={isPreferredApiMongoDB ? "documentTabSearchBar" : "documentSqlTabSearchBar"}
                  onFocus={() => this.setState({ isSuggestionVisible: true })}
                  onChange={(_event, newInput?: string) => {
                    this.setState({ filter: newInput });
                  }}
                  value={filter}
                />
                <PrimaryButton text="Apply Filter" onClick={this.handleFilter} className="documentTabFiltetButton" />
                <Image
                  src={CloseIcon}
                  alt="Close icon"
                  {...imageProps}
                  onClick={() => this.setState({ isFilterOptionVisible: false })}
                />
              </Stack>
            </div>
            {isSuggestionVisible && (
              <div className={isPreferredApiMongoDB ? "filterSuggestions" : "filterSuggestions sqlFilterSuggestions"}>
                <List items={getFilterSuggestions(isPreferredApiMongoDB)} onRenderCell={this.onRenderCell} />
              </div>
            )}
          </div>
        )}
        {!isFilterOptionVisible && (
          <Stack horizontal verticalFill wrap className="documentTabNoFilterView">
            <Text className="noFilterText">{getfilterText(isPreferredApiMongoDB, filter)}</Text>
            <PrimaryButton text="Edit Filter" onClick={() => this.setState({ isFilterOptionVisible: true })} />
          </Stack>
        )}
        <div className="splitterWrapper" onClick={() => this.setState({ isSuggestionVisible: false })}>
          <SplitterLayout primaryIndex={0} secondaryInitialSize={1000}>
            <div className="leftSplitter">
              <DetailsList
                items={getDocumentItems(isPreferredApiMongoDB, documentIds, documentSqlIds, isAllDocumentsVisible)}
                compact={isCompactMode}
                columns={columns}
                selectionMode={SelectionMode.none}
                getKey={this.getKey}
                setKey="none"
                layoutMode={DetailsListLayoutMode.justified}
                isHeaderVisible={true}
              />
              <Text onClick={this.handleLoadMoreDocument} className="documentLoadMore" block={true}>
                Load More
              </Text>
            </div>
            {isEditorVisible ? (
              <div className="react-editor">
                <EditorReact
                  language={"json"}
                  content={documentContent}
                  isReadOnly={false}
                  ariaLabel={"Document json"}
                  onContentChanged={this.handleDocumentContentChange}
                  lineNumbers="on"
                  editorKey={editorKey}
                />
              </div>
            ) : (
              <div className="documentTabWatermark">
                <Image src={DocumentWaterMark} alt="Document watermark" />
                <Text className="documentCreateText">Create new or work with existing document(s).</Text>
              </div>
            )}
          </SplitterLayout>
        </div>
      </div>
    );
  }
}