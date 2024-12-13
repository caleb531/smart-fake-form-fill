export type PicklistFieldDefinition = {
	name: string;
	label: string | null;
	isMultiSelect: boolean;
	values: (string | null | undefined)[];
};

export type TextFieldDefinition = {
	name: string;
	type?: string;
	label: string | null;
	pattern?: string;
};

export type FieldDefinition = PicklistFieldDefinition | TextFieldDefinition;

export type FieldValues = Record<string, string | string[]>;
export type StatusCode = 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'CANCELED';
export type Status = {
	code: StatusCode;
	message?: string;
};

export type FormFillerRequest = {
	action: 'fillForm';
	tabId: number | undefined;
	formSelector?: string;
};
export type StatusUpdateRequest = {
	action: 'updateStatus';
	status: Status;
	errorMessage?: string;
};
export type FieldValueGetterRequest = {
	action: 'getFieldValues';
	tabId: number | undefined;
	fieldDefinitions: FieldDefinition[];
};
export type FieldPopulatorRequest = {
	action: 'populateFieldsIntoForm';
	fieldValues: FieldValues;
};
export type GetStatusRequest = {
	action: 'getStatus';
};

export type FieldDefinitionGetterResponse = {
	status: Status;
	fieldDefinitions: FieldDefinition[];
	errorMessage?: string;
};
export type FieldValueGetterResponse = {
	status: Status;
	fieldValues?: FieldValues;
	errorMessage?: string;
};
export type FormFillerResponse = FieldValueGetterResponse;
export type FieldPopulatorResponse = {
	status: Status;
	errorMessage?: string;
};
