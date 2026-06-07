import api from './api';

export type CustomFieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox';

export interface CustomFieldDef {
  id: string;
  name: string;
  type: CustomFieldType;
  options: string[];
  order: number;
}

export const customFieldService = {
  list: async (teamId: string): Promise<CustomFieldDef[]> => {
    const res = await api.get('/custom-fields', { params: { teamId } });
    return res.data?.data?.fields ?? [];
  },
  create: async (body: { teamId: string; name: string; type: CustomFieldType; options?: string[] }): Promise<CustomFieldDef> => {
    const res = await api.post('/custom-fields', body);
    return res.data?.data?.field;
  },
  update: async (id: string, body: { name?: string; options?: string[] }): Promise<CustomFieldDef> => {
    const res = await api.patch(`/custom-fields/${id}`, body);
    return res.data?.data?.field;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/custom-fields/${id}`);
  },
  /** Merge custom field values onto a task. */
  setTaskValues: async (taskId: string, values: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const res = await api.patch(`/tasks/${taskId}/custom-fields`, { values });
    return res.data?.data?.customFields ?? {};
  },
};

export const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
];
