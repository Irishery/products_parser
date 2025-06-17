// exporter.ts
import fs from 'fs';
import Types from '../types/types'

export default class Exporter {
  private data: Types.ExportData;
  private cfg: Types.Config;

  constructor(data: Types.ExportData, cfg: Types.Config) {
    this.data = data;
    this.cfg = cfg;
  }

  private getTime(): string {
    return new Date().toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss
  }

  public exportXml(): void {
    const fileName = this.cfg.filename
      ? `./${this.cfg.filename}.xml`
      : './export.xml';

    const { name, company, url, categories, products, modifiers_groups } = this.data;

    const xml: string[] = [];

    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push(`<yml_catalog date="${this.getTime()}">`);
    xml.push('<shop>');

    xml.push(`<name>${name}</name>`);
    xml.push(`<company>${company}</company>`);
    xml.push(`<url>${url}</url>`);

    xml.push('<currencies><currency id="RUR" rate="1"/></currencies>');

    let groupId = 1;
    let modifierId = 1;
    const mg: string[] = [];
    const mm: string[] = [];

    for (const group of modifiers_groups) {
      mg.push(`<modifiersGroup id="${groupId}">`);
      mg.push(`<name>${group.name}</name>`);
      mg.push(`<type>${group.type}</type>`);
      mg.push(`<minimum>${group.min}</minimum>`);
      mg.push(`<maximum>${group.max}</maximum>`);
      mg.push('</modifiersGroup>');

      // Если модификаторы внутри group
      const anyGroup = group as any;
      if (anyGroup.modifiers) {
        for (const modifier of anyGroup.modifiers) {
          mm.push(`<modifier id="${modifier.id || modifierId}" required="true">`);
          mm.push(`<name>${modifier.name}</name>`);
          mm.push(`<price>${modifier.price}</price>`);
          mm.push(`<modifiersGroupId>${groupId}</modifiersGroupId>`);
          mm.push('</modifier>');
          modifierId++;
        }
      }

      groupId++;
    }

    if (mg.length) xml.push(`<modifiersGroups>${mg.join('')}</modifiersGroups>`);
    if (mm.length) xml.push(`<modifiers>${mm.join('')}</modifiers>`);

    xml.push('<categories>');
    for (const category of categories) {
      const parentAttr = category.parent_id ? ` parent_id="${category.parent_id}"` : '';
      xml.push(`<category id="${category.id}"${parentAttr}>${category.name}</category>`);
    }
    xml.push('</categories>');


    xml.push('<offers>');
    for (const productId in products) {
      const product = products[productId];
      console.log('🔍 Product:', product.id, product.name, 'Price:', product.price);

      if (!product.name) continue;

      xml.push(`<offer id="${product.id}" available="true">`);
      xml.push(`<name>${product.name}</name>`);

      if (product.description) {
        xml.push(`<description><![CDATA[${product.description}]]></description>`);
      } else {
        xml.push('<description></description>');
      }

      if (product.picture) {
        xml.push(`<picture>${product.picture}</picture>`);
      }

      xml.push('<parameters>');
      if (product.price) {
        for (const param of product.price) {
          const paramId = param.id || product.id;
          xml.push(`<parameter id="${paramId}">`);
          xml.push(`<price>${param.price}</price>`);
          if (param.old_price) {
            xml.push(`<old_price>${param.old_price}</old_price>`);
          }
          xml.push(`<description>${param.description ?? 1}</description>`);
          xml.push(`<descriptionIndex>${param.index?.[1] ?? 10}</descriptionIndex>`);
          xml.push('</parameter>');
        }
      }
      xml.push('</parameters>');

      xml.push(`<categoryId>${product.category}</categoryId>`);

      if (product.labels?.length) {
        xml.push('<labelsIds>');
        for (const label of product.labels) {
          xml.push(`<labelId>${label}</labelId>`);
        }
        xml.push('</labelsIds>');
      }

      if (product.modifiers?.length) {
        xml.push('<modifiersGroupsIds>');
        for (const mod of product.modifiers) {
          xml.push(`<modifiersGroupId>${mod}</modifiersGroupId>`);
        }
        xml.push('</modifiersGroupsIds>');
      }

      xml.push('</offer>');
    }
    xml.push('</offers>');

    xml.push('</shop>');
    xml.push('</yml_catalog>');

    fs.writeFile(fileName, xml.join(''), (err) => {
      if (err) {
        console.error('Ошибка при записи файла:', err.message);
      } else {
        console.log('Экспорт завершён успешно:', fileName);
      }
    });
  }
}

