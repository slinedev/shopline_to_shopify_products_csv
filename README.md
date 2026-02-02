# 从 Shopline 1.0 迁移到 Shopify？一键导出标准商品 CSV 的实用脚本

近日，有不少使用 Shopline 1.0 的商家反馈：官方后台导出的商品列表是 XLSX 格式，不仅字段杂乱、重复（中英文混杂），最关键的是**完全缺失商品图片 URL**，导致无法直接用于其他平台导入。这对于想要迁移到 Shopify 的商家来说，简直是“卡脖子”的痛点——Shopify 的商品导入必须使用严格的 CSV 模板，图片、变体、库存、SEO 等信息缺一不可。

手动整理数百上千个商品？几乎不可能。  
官方导出又不完善？这让很多商家望而却步。

于是，我开发了一个**纯浏览器脚本**，登录 Shopline 后台后，直接在控制台运行即可一键导出**完全符合 Shopify 官方导入模板**的 CSV 文件，包含：

- 完整的商品标题、描述、SEO 信息
- 所有图片 URL（支持多张图片自动生成额外行）
- 正确的价格逻辑（促销价 → Price，原价 → Compare-at Price）
- 库存、重量、SKU、条码、标签等关键字段
- 自动生成 URL Handle
- Google Shopping 相关字段预填充

目前已验证支持**无变体商品**（Shopline 大多数店铺以简单商品为主），有变体会友好提示跳过，后续可按需扩展。

### 为什么需要这个脚本？

1. **Shopline 1.0 官方导出痛点**  
   - 格式为 XLSX，且中英文字段重复  
   - 缺少图片 URL（迁移到任何平台都必须手动补）  
   - 字段命名不标准，无法直接用于 Shopify 导入  
   - 变体商品处理复杂，容易出错

2. **Shopify 导入要求严格**  
   Shopify 官方提供固定 CSV 模板（包含 50+ 列），必须精确匹配，否则导入失败。官方导出工具无法满足从 Shopline 迁移的需求。

3. **脚本的价值**  
   - 零成本、无需第三方工具  
   - 直接调用 Shopline 内部 API 获取最新最全数据  
   - 输出文件 100% 兼容 Shopify “产品导入” 功能  
   - 帮助商家快速完成迁移，节省大量时间  
   - 也希望能给 Shopline 官方一些启发：完善导出功能，让商家迁移更顺畅

### 脚本功能亮点

- **自动分页获取所有商品**（无需担心商品数量上限）
- **智能处理多语言字段**（优先取英文，其次繁体）
- **完整保留图片**（主图 + 附加图自动生成多行）
- **价格逻辑完善**（有促销价时自动填充 Compare-at Price）
- **库存处理**（无限库存自动设为 CONTINUE 超卖）
- **SEO 字段自动填充**（标题、描述智能 fallback）
- **Google Shopping 字段预填充**（性别、年龄段、状况等）
- **Vendor、Product Category 等留空方便后续批量修改**

### 使用方法（超简单）

1. 登录 Shopline 1.0 后台 https://admin.shoplineapp.com
2. 打开浏览器开发者工具（按 F12 或右键 → 检查）
3. 切换到 **Console**（控制台）标签
4. 将下方完整脚本复制粘贴进去，按回车执行
5. 等待几秒至几分钟（取决于商品数量），浏览器自动下载 `shopline_to_shopify_products.csv`

```javascript
(async function() {
  const merchantId = window.__PRELOADED_STATE__?.merchantData?._id;
  if (!merchantId) {
    alert('无法找到商户 ID，请确保已登录 Shopline 后台');
    return;
  }

  const limit = 200;
  let page = 1;
  const allProducts = [];

  try {
    while (true) {
      const url = `https://admin.shoplineapp.com/api/admin/v1/${merchantId}/products?page=${page}&limit=${limit}`;
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();

      if (!json.result || !json.data?.items || json.data.items.length === 0) break;

      allProducts.push(...json.data.items);
      console.log(`已获取第 ${page} 页，共 ${json.data.items.length} 个商品，累计 ${allProducts.length}`);

      if (json.data.items.length < limit) break;
      page++;
    }
  } catch (err) {
    console.error(err);
    alert('获取商品数据失败，请检查网络或重新登录');
    return;
  }

  if (allProducts.length === 0) {
    alert('未获取到任何商品');
    return;
  }

  const columns = ["Title","URL handle","Description","Vendor","Product category","Type","Tags","Published on online store","Status","SKU","Barcode","Option1 name","Option1 value","Option1 Linked To","Option2 name","Option2 value","Option2 Linked To","Option3 name","Option3 value","Option3 Linked To","Price","Compare-at price","Cost per item","Charge tax","Tax code","Unit price total measure","Unit price total measure unit","Unit price base measure","Unit price base measure unit","Inventory tracker","Inventory quantity","Continue selling when out of stock","Weight value (grams)","Weight unit for display","Requires shipping","Fulfillment service","Product image URL","Image position","Image alt text","Variant image URL","Gift card","SEO title","SEO description","Color (product.metafields.shopify.color-pattern)","Google Shopping / Google product category","Google Shopping / Gender","Google Shopping / Age group","Google Shopping / Manufacturer part number (MPN)","Google Shopping / Ad group name","Google Shopping / Ads labels","Google Shopping / Condition","Google Shopping / Custom product","Google Shopping / Custom label 0","Google Shopping / Custom label 1","Google Shopping / Custom label 2","Google Shopping / Custom label 3","Google Shopping / Custom label 4"];

  const rows = [columns];

  const slugify = (text) => {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const getTrans = (obj) => {
    return obj?.en || obj?.["zh-hant"] || obj?.["zh-cn"] || Object.values(obj || {})[0] || '';
  };

  for (const p of allProducts) {
    if (p.variations?.length > 0) {
      console.warn(`商品 ${p._id} 包含变体，已跳过（变体支持尚未实现）`);
      continue;
    }

    const title = getTrans(p.title_translations);
    if (!title) continue;

    const handle = slugify(title);
    const description = getTrans(p.description_translations) || getTrans(p.summary_translations);
    const seoTitle = getTrans(p.seo_title_translations) || title;
    const seoDesc = getTrans(p.seo_description_translations) || getTrans(p.summary_translations);

    let price = '0.00';
    let compareAt = '';
    const regPrice = p.price?.dollars || 0;
    const salePrice = p.price_sale?.dollars > 0 ? p.price_sale.dollars : null;
    if (salePrice !== null && salePrice < regPrice) {
      price = salePrice.toFixed(2);
      compareAt = regPrice.toFixed(2);
    } else {
      price = regPrice.toFixed(2);
    }

    const cost = p.cost?.dollars ? p.cost.dollars.toFixed(2) : '';
    const sku = p.sku || '';
    const barcode = p.barcode || p.gtin || '';
    const taxable = p.taxable ? 'TRUE' : 'FALSE';
    const unlimited = p.unlimited_quantity;
    const tracker = unlimited ? '' : 'shopify';
    const qty = unlimited ? '' : (p.quantity ?? '');
    const continueSelling = unlimited ? 'CONTINUE' : 'DENY';
    const weightGrams = p.weight ? Math.round(p.weight * 1000) : 0;

    const images = [];
    if (p.cover_media_array?.length) {
      p.cover_media_array.forEach(m => m.original_image_url && images.push(m.original_image_url));
    } else if (p.media?.length) {
      p.media.forEach(m => m.images?.original?.url && images.push(m.images.original.url));
    }

    const mainRow = {};
    mainRow['Title'] = title;
    mainRow['URL handle'] = handle;
    mainRow['Description'] = description;
    mainRow['Vendor'] = '';
    mainRow['Product category'] = '';
    mainRow['Type'] = '';
    mainRow['Tags'] = p.tags_array?.join(', ') || p.tags || '';
    mainRow['Published on online store'] = 'TRUE';
    mainRow['Status'] = p.status === 'active' ? 'Active' : 'Draft';
    mainRow['SKU'] = sku;
    mainRow['Barcode'] = barcode;
    mainRow['Price'] = price;
    mainRow['Compare-at price'] = compareAt;
    mainRow['Cost per item'] = cost;
    mainRow['Charge tax'] = taxable;
    mainRow['Inventory tracker'] = tracker;
    mainRow['Inventory quantity'] = qty;
    mainRow['Continue selling when out of stock'] = continueSelling;
    mainRow['Weight value (grams)'] = weightGrams;
    mainRow['Weight unit for display'] = 'g';
    mainRow['Requires shipping'] = 'TRUE';
    mainRow['Fulfillment service'] = 'manual';
    mainRow['Product image URL'] = images[0] || '';
    mainRow['Image position'] = '1';
    mainRow['Image alt text'] = title;
    mainRow['Gift card'] = 'FALSE';
    mainRow['SEO title'] = seoTitle;
    mainRow['SEO description'] = seoDesc;
    mainRow['Google Shopping / Gender'] = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : 'Unisex';
    mainRow['Google Shopping / Age group'] = 'Adult (13+ years old)';
    mainRow['Google Shopping / Manufacturer part number (MPN)'] = p.mpn || '';
    mainRow['Google Shopping / Condition'] = 'New';
    mainRow['Google Shopping / Custom product'] = 'FALSE';

    rows.push(columns.map(col => mainRow[col] ?? ''));

    for (let i = 1; i < images.length; i++) {
      const imgRow = {};
      imgRow['URL handle'] = handle;
      imgRow['Product image URL'] = images[i];
      imgRow['Image position'] = (i + 1).toString();
      imgRow['Image alt text'] = title;
      rows.push(columns.map(col => imgRow[col] ?? ''));
    }
  }

  const csv = rows.map(row => 
    row.map(cell => {
      cell = cell === null || cell === undefined ? '' : String(cell);
      if (cell.includes('"') || cell.includes(',') || cell.includes('\n') || cell.includes('\r')) {
        cell = '"' + cell.replace(/"/g, '""') + '"';
      }
      return cell;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'shopline_to_shopify_products.csv';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log('导出完成！');
  alert(`成功导出 ${allProducts.length} 个商品（变体商品已跳过）`);
})();
```

### 注意事项

- 目前完美支持**无变体商品**，有变体会在控制台提示跳过
- Vendor、Product Category 等字段留空，建议导出后在 Excel 中批量填充
- 重量单位假设 API 返回为 kg，已自动转为 grams（如实际为 grams 可修改脚本）
- 请在正式迁移前，先用少量商品测试导入 Shopify

### 写在最后

这个脚本的初衷很简单：**帮助更多商家更轻松地完成平台迁移**。Shopline 作为优秀的建站平台，相信未来也会持续优化导出功能。但在官方完善之前，这个小脚本希望能切实解决大家的燃眉之急。

如果你正在考虑从 Shopline 1.0 迁移到 Shopify，欢迎试用这个脚本！有任何问题或需要增加变体支持，随时留言，我会持续更新。

祝建站顺利，生意兴隆！
