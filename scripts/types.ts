type PicklistFieldDefinition = {
	name: string;
	label: string | null;
	values: (string | null | undefined)[];
};

type TextFieldDefinition = {
	name: string;
	label: string | null;
	pattern?: string;
};

export type FieldDefinition = PicklistFieldDefinition | TextFieldDefinition;
