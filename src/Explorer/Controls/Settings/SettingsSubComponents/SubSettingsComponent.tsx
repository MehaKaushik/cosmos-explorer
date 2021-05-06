import { ChoiceGroup, IChoiceGroupOption, Label, Link, MessageBar, Stack, Text, TextField } from "@fluentui/react";
import * as React from "react";
import * as ViewModels from "../../../../Contracts/ViewModels";
import { userContext } from "../../../../UserContext";
import Explorer from "../../../Explorer";
import { Int32 } from "../../../Panes/Tables/Validators/EntityPropertyValidationCommon";
import {
  changeFeedPolicyToolTip,
  getChoiceGroupStyles,
  getTextFieldStyles,
  messageBarStyles,
  subComponentStackProps,
  titleAndInputStackProps,
  ttlWarning,
} from "../SettingsRenderUtils";
import {
  ChangeFeedPolicyState,
  GeospatialConfigType,
  getSanitizedInputValue,
  IsComponentDirtyResult,
  isDirty,
  TtlOff,
  TtlOn,
  TtlOnNoDefault,
  TtlType,
} from "../SettingsUtils";
import { ToolTipLabelComponent } from "./ToolTipLabelComponent";

export interface SubSettingsComponentProps {
  collection: ViewModels.Collection;
  container: Explorer;

  timeToLive: TtlType;
  timeToLiveBaseline: TtlType;

  onTtlChange: (newTtl: TtlType) => void;
  timeToLiveSeconds: number;
  timeToLiveSecondsBaseline: number;
  onTimeToLiveSecondsChange: (newTimeToLiveSeconds: number) => void;

  geospatialConfigType: GeospatialConfigType;
  geospatialConfigTypeBaseline: GeospatialConfigType;
  onGeoSpatialConfigTypeChange: (newGeoSpatialConfigType: GeospatialConfigType) => void;

  isAnalyticalStorageEnabled: boolean;
  analyticalStorageTtlSelection: TtlType;
  analyticalStorageTtlSelectionBaseline: TtlType;
  onAnalyticalStorageTtlSelectionChange: (newAnalyticalStorageTtlSelection: TtlType) => void;

  analyticalStorageTtlSeconds: number;
  analyticalStorageTtlSecondsBaseline: number;
  onAnalyticalStorageTtlSecondsChange: (newAnalyticalStorageTtlSeconds: number) => void;

  changeFeedPolicyVisible: boolean;
  changeFeedPolicy: ChangeFeedPolicyState;
  changeFeedPolicyBaseline: ChangeFeedPolicyState;
  onChangeFeedPolicyChange: (newChangeFeedPolicyState: ChangeFeedPolicyState) => void;
  onSubSettingsSaveableChange: (isSubSettingsSaveable: boolean) => void;
  onSubSettingsDiscardableChange: (isSubSettingsDiscardable: boolean) => void;
}

export class SubSettingsComponent extends React.Component<SubSettingsComponentProps> {
  private shouldCheckComponentIsDirty = true;
  private geospatialVisible: boolean;
  private partitionKeyValue: string;
  private partitionKeyName: string;

  constructor(props: SubSettingsComponentProps) {
    super(props);
    this.geospatialVisible = userContext.apiType === "SQL";
    this.partitionKeyValue = "/" + this.props.collection.partitionKeyProperty;
    this.partitionKeyName = userContext.apiType === "Mongo" ? "Shard key" : "Partition key";
  }

  componentDidMount(): void {
    this.onComponentUpdate();
  }

  componentDidUpdate(): void {
    this.onComponentUpdate();
  }

  private onComponentUpdate = (): void => {
    if (!this.shouldCheckComponentIsDirty) {
      this.shouldCheckComponentIsDirty = true;
      return;
    }

    const isComponentDirtyResult = this.IsComponentDirty();
    this.props.onSubSettingsSaveableChange(isComponentDirtyResult.isSaveable);
    this.props.onSubSettingsDiscardableChange(isComponentDirtyResult.isDiscardable);

    this.shouldCheckComponentIsDirty = false;
  };

  public IsComponentDirty = (): IsComponentDirtyResult => {
    if (
      (this.props.timeToLive === TtlType.On && !this.props.timeToLiveSeconds) ||
      (this.props.analyticalStorageTtlSelection === TtlType.On && !this.props.analyticalStorageTtlSeconds)
    ) {
      return { isSaveable: false, isDiscardable: true };
    } else if (
      isDirty(this.props.timeToLive, this.props.timeToLiveBaseline) ||
      (this.props.timeToLive === TtlType.On &&
        isDirty(this.props.timeToLiveSeconds, this.props.timeToLiveSecondsBaseline)) ||
      isDirty(this.props.analyticalStorageTtlSelection, this.props.analyticalStorageTtlSelectionBaseline) ||
      (this.props.analyticalStorageTtlSelection === TtlType.On &&
        isDirty(this.props.analyticalStorageTtlSeconds, this.props.analyticalStorageTtlSecondsBaseline)) ||
      isDirty(this.props.geospatialConfigType, this.props.geospatialConfigTypeBaseline) ||
      isDirty(this.props.changeFeedPolicy, this.props.changeFeedPolicyBaseline)
    ) {
      return { isSaveable: true, isDiscardable: true };
    }

    return { isSaveable: false, isDiscardable: false };
  };

  private ttlChoiceGroupOptions: IChoiceGroupOption[] = [
    { key: TtlType.Off, text: "Off" },
    { key: TtlType.OnNoDefault, text: "On (no default)" },
    { key: TtlType.On, text: "On" },
  ];

  public getTtlValue = (value: string): TtlType => {
    switch (value) {
      case TtlOn:
        return TtlType.On;
      case TtlOff:
        return TtlType.Off;
      case TtlOnNoDefault:
        return TtlType.OnNoDefault;
    }
    return undefined;
  };

  private onTtlChange = (ev?: React.FormEvent<HTMLElement | HTMLInputElement>, option?: IChoiceGroupOption): void =>
    this.props.onTtlChange(this.getTtlValue(option.key));

  private onTimeToLiveSecondsChange = (
    event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
  ): void => {
    const newTimeToLiveSeconds = getSanitizedInputValue(newValue, Int32.Max);
    this.props.onTimeToLiveSecondsChange(newTimeToLiveSeconds);
  };

  private onGeoSpatialConfigTypeChange = (
    ev?: React.FormEvent<HTMLElement | HTMLInputElement>,
    option?: IChoiceGroupOption
  ): void =>
    this.props.onGeoSpatialConfigTypeChange(GeospatialConfigType[option.key as keyof typeof GeospatialConfigType]);

  private onAnalyticalStorageTtlSelectionChange = (
    ev?: React.FormEvent<HTMLElement | HTMLInputElement>,
    option?: IChoiceGroupOption
  ): void => this.props.onAnalyticalStorageTtlSelectionChange(this.getTtlValue(option.key));

  private onAnalyticalStorageTtlSecondsChange = (
    event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
  ): void => {
    const newAnalyticalStorageTtlSeconds = getSanitizedInputValue(newValue, Int32.Max);
    this.props.onAnalyticalStorageTtlSecondsChange(newAnalyticalStorageTtlSeconds);
  };

  private onChangeFeedPolicyChange = (
    ev?: React.FormEvent<HTMLElement | HTMLInputElement>,
    option?: IChoiceGroupOption
  ): void =>
    this.props.onChangeFeedPolicyChange(ChangeFeedPolicyState[option.key as keyof typeof ChangeFeedPolicyState]);

  private getTtlComponent = (): JSX.Element =>
    userContext.apiType === "Mongo" ? (
      <MessageBar
        messageBarIconProps={{ iconName: "InfoSolid", className: "messageBarInfoIcon" }}
        styles={{ text: { fontSize: 14 } }}
      >
        To enable time-to-live (TTL) for your collection/documents,
        <Link href="https://docs.microsoft.com/en-us/azure/cosmos-db/mongodb-time-to-live" target="_blank">
          create a TTL index
        </Link>
        .
      </MessageBar>
    ) : (
      <Stack {...titleAndInputStackProps}>
        <ChoiceGroup
          id="timeToLive"
          label="Time to Live"
          selectedKey={this.props.timeToLive}
          options={this.ttlChoiceGroupOptions}
          onChange={this.onTtlChange}
          styles={getChoiceGroupStyles(this.props.timeToLive, this.props.timeToLiveBaseline)}
        />
        {isDirty(this.props.timeToLive, this.props.timeToLiveBaseline) && this.props.timeToLive === TtlType.On && (
          <MessageBar
            messageBarIconProps={{ iconName: "InfoSolid", className: "messageBarInfoIcon" }}
            styles={messageBarStyles}
          >
            {ttlWarning}
          </MessageBar>
        )}
        {this.props.timeToLive === TtlType.On && (
          <TextField
            id="timeToLiveSeconds"
            styles={getTextFieldStyles(this.props.timeToLiveSeconds, this.props.timeToLiveSecondsBaseline)}
            type="number"
            required
            min={1}
            max={Int32.Max}
            value={this.props.timeToLiveSeconds?.toString()}
            onChange={this.onTimeToLiveSecondsChange}
            suffix="second(s)"
          />
        )}
      </Stack>
    );

  private analyticalTtlChoiceGroupOptions: IChoiceGroupOption[] = [
    { key: TtlType.Off, text: "Off", disabled: true },
    { key: TtlType.OnNoDefault, text: "On (no default)" },
    { key: TtlType.On, text: "On" },
  ];

  private getAnalyticalStorageTtlComponent = (): JSX.Element => (
    <Stack {...titleAndInputStackProps}>
      <ChoiceGroup
        id="analyticalStorageTimeToLive"
        label="Analytical Storage Time to Live"
        selectedKey={this.props.analyticalStorageTtlSelection}
        options={this.analyticalTtlChoiceGroupOptions}
        onChange={this.onAnalyticalStorageTtlSelectionChange}
        styles={getChoiceGroupStyles(
          this.props.analyticalStorageTtlSelection,
          this.props.analyticalStorageTtlSelectionBaseline
        )}
      />
      {this.props.analyticalStorageTtlSelection === TtlType.On && (
        <TextField
          id="analyticalStorageTimeToLiveSeconds"
          styles={getTextFieldStyles(
            this.props.analyticalStorageTtlSeconds,
            this.props.analyticalStorageTtlSecondsBaseline
          )}
          type="number"
          required
          min={1}
          max={Int32.Max}
          value={this.props.analyticalStorageTtlSeconds?.toString()}
          suffix="second(s)"
          onChange={this.onAnalyticalStorageTtlSecondsChange}
        />
      )}
    </Stack>
  );

  private geoSpatialConfigTypeChoiceGroupOptions: IChoiceGroupOption[] = [
    { key: GeospatialConfigType.Geography, text: "Geography" },
    { key: GeospatialConfigType.Geometry, text: "Geometry" },
  ];

  private getGeoSpatialComponent = (): JSX.Element => (
    <ChoiceGroup
      id="geoSpatialConfig"
      label="Geospatial Configuration"
      selectedKey={this.props.geospatialConfigType}
      options={this.geoSpatialConfigTypeChoiceGroupOptions}
      onChange={this.onGeoSpatialConfigTypeChange}
      styles={getChoiceGroupStyles(this.props.geospatialConfigType, this.props.geospatialConfigTypeBaseline)}
    />
  );

  private changeFeedChoiceGroupOptions: IChoiceGroupOption[] = [
    { key: ChangeFeedPolicyState.Off, text: "Off" },
    { key: ChangeFeedPolicyState.On, text: "On" },
  ];

  private getChangeFeedComponent = (): JSX.Element => {
    const labelId = "settingsV2ChangeFeedLabelId";

    return (
      <Stack>
        <Label id={labelId}>
          <ToolTipLabelComponent label="Change feed log retention policy" toolTipElement={changeFeedPolicyToolTip} />
        </Label>
        <ChoiceGroup
          id="changeFeedPolicy"
          selectedKey={this.props.changeFeedPolicy}
          options={this.changeFeedChoiceGroupOptions}
          onChange={this.onChangeFeedPolicyChange}
          styles={getChoiceGroupStyles(this.props.changeFeedPolicy, this.props.changeFeedPolicyBaseline)}
          aria-labelledby={labelId}
        />
      </Stack>
    );
  };

  private getPartitionKeyComponent = (): JSX.Element => (
    <Stack {...titleAndInputStackProps}>
      {this.getPartitionKeyVisible() && (
        <TextField
          label={this.partitionKeyName}
          disabled
          styles={getTextFieldStyles(undefined, undefined)}
          defaultValue={this.partitionKeyValue}
        />
      )}

      {this.isLargePartitionKeyEnabled() && <Text>Large {this.partitionKeyName.toLowerCase()} has been enabled</Text>}
    </Stack>
  );

  public getPartitionKeyVisible = (): boolean => {
    if (
      userContext.apiType === "Cassandra" ||
      userContext.apiType === "Tables" ||
      !this.props.collection.partitionKeyProperty ||
      (userContext.apiType === "Mongo" && this.props.collection.partitionKey.systemKey)
    ) {
      return false;
    }
    return true;
  };

  public isLargePartitionKeyEnabled = (): boolean => this.props.collection.partitionKey?.version >= 2;

  public render(): JSX.Element {
    return (
      <Stack {...subComponentStackProps}>
        {userContext.apiType !== "Cassandra" && this.getTtlComponent()}

        {this.geospatialVisible && this.getGeoSpatialComponent()}

        {this.props.isAnalyticalStorageEnabled && this.getAnalyticalStorageTtlComponent()}

        {this.props.changeFeedPolicyVisible && this.getChangeFeedComponent()}

        {this.getPartitionKeyComponent()}
      </Stack>
    );
  }
}
