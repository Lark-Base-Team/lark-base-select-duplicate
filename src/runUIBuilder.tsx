import { bitable, IFieldMeta, UIBuilder, ISingleSelectField, SelectOptionsType, FieldType } from "@lark-base-open/js-sdk";
import { UseTranslationResponse } from 'react-i18next';

interface FormValues {
  table: { id: string };
  field: Array<{ id: string }>;
}

export default async function(uiBuilder: UIBuilder, { t }: UseTranslationResponse<'translation', undefined>) {
  uiBuilder.markdown(`## 欢迎使用选项去重插件`);
  uiBuilder.form((form) => ({
    formItems: [
      form.tableSelect('table', { label: '选择数据表' }),
      form.fieldSelect('field', {
        label: '选择单选/多选字段',
        sourceTable: 'table',
        filterByTypes: [FieldType.SingleSelect, FieldType.MultiSelect],
        multiple: true
      }),
    ],
    buttons: ['确定'],
  }), async ({ values }) => {
    try {
      const { table, field } = values as unknown as FormValues;
      if (!field || field.length === 0) {
        uiBuilder.message.info('请选择想要去重的字段');
        return;
      }
      uiBuilder.text('开始处理...');
      // Find current table by tableId
      const tableIns = await bitable.base.getTableById((table).id);
      // Get table's field meta list
      const fieldMetaList = await tableIns.getFieldMetaList();
      const filteredFields: IFieldMeta[] = [];
      field.forEach((it) => {
        fieldMetaList.forEach((meta) => {
          if (meta.id === it.id) {
            filteredFields.push(meta);
          }
        });
      });
      if (filteredFields.length === 0) {
        uiBuilder.text('无可用单选/多选字段，请重新选择');
        return;
      }
      for await (const filteredField of filteredFields) {
        uiBuilder.text(`开始处理字段 ${filteredField.name}`);
        const fieldIns = await tableIns.getField<ISingleSelectField>(filteredField.id);
        const optionsType = await fieldIns.getOptionsType();
        if (optionsType === SelectOptionsType.DYNAMIC) {
          uiBuilder.text(`不支持引用选项字段：${filteredField.name}`);
          return;
        }
        const options = await fieldIns.getOptions();
        if (options?.length === 0) {
          return uiBuilder.text(`字段「${filteredField.name}」无可用选项`);
        } else {
          uiBuilder.text(`字段「${filteredField.name}」有 ${options.length} 个选项`);
        }
        const optionMap: Record<string, boolean> = {};
        for await (const option of options) {
          if (!optionMap[option.name]) {
            optionMap[option.name] = true;
            continue;
          }
          await fieldIns.deleteOption(option.id);
          uiBuilder.text(`字段「${filteredField.name}」中的重复选项：${option.name} 已删除`);
        }
        uiBuilder.text('处理完成！');
      }
    } catch (error: any) {
      console.error(error);
      uiBuilder.text(error.message);
    }
  });
}