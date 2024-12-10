export type PicklistFieldDefinition = {
	name: string;
	label: string | null;
	isMultiSelect: boolean;
	values: (string | null | undefined)[];
};

export type TextFieldDefinition = {
	name: string;
	label: string | null;
	pattern?: string;
};

export type FieldDefinition = PicklistFieldDefinition | TextFieldDefinition;

export type FieldValues = Record<string, string | string[]>;

export type FormFillerRequest = {
	action: 'fillForm';
	formSelector?: string;
};
export type FieldDefinitionGetterRequest = {
	action: 'getFieldDefinitions';
	formSelector: string;
};
export type FieldValueGetterRequest = {
	action: 'getFieldValues';
	fieldDefinitions: FieldDefinition[];
};
export type FieldPopulatorRequest = {
	action: 'populateFieldsIntoForm';
	fieldValues: FieldValues;
};

export type MessageResponseStatus = 'success' | 'partial' | 'error';

export type FieldDefinitionGetterResponse = {
	status: MessageResponseStatus;
	fieldDefinitions: FieldDefinition[];
	errorMessage?: string;
};
export type FieldValueGetterResponse = {
	status: MessageResponseStatus;
	fieldValues?: FieldValues;
	errorMessage?: string;
};
export type FormFillerResponse = FieldValueGetterResponse;
export type FieldPopulatorResponse = {
	status: MessageResponseStatus;
	errorMessage?: string;
};
