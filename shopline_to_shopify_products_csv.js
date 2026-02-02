(async function() {
  // 获取商户 ID
  const merchantId = window.__PRELOADED_STATE__?.merchantData?._id;
  if (!merchantId) {
    alert('无法找到商户 ID，请确保已登录 Shopline 后台');
    return;
  }

  // 分页获取所有商品（尝试大 limit，如果 API 不支持会自动使用默认值）
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

  // Shopify CSV 列顺序（严格按照你提供的模板）
  const columns = [
    "Title","URL handle","Description","Vendor","Product category","Type","Tags","Published on online store","Status",
    "SKU","Barcode","Option1 name","Option1 value","Option1 Linked To","Option2 name","Option2 value","Option2 Linked To",
    "Option3 name","Option3 value","Option3 Linked To","Price","Compare-at price","Cost per item","Charge tax","Tax code",
    "Unit price total measure","Unit price total measure unit","Unit price base measure","Unit price base measure unit",
    "Inventory tracker","Inventory quantity","Continue selling when out of stock","Weight value (grams)","Weight unit for display",
    "Requires shipping","Fulfillment service","Product image URL","Image position","Image alt text","Variant image URL",
    "Gift card","SEO title","SEO description","Color (product.metafields.shopify.color-pattern)",
    "Google Shopping / Google product category","Google Shopping / Gender","Google Shopping / Age group",
    "Google Shopping / Manufacturer part number (MPN)","Google Shopping / Ad group name","Google Shopping / Ads labels",
    "Google Shopping / Condition","Google Shopping / Custom product","Google Shopping / Custom label 0",
    "Google Shopping / Custom label 1","Google Shopping / Custom label 2","Google Shopping / Custom label 3","Google Shopping / Custom label 4"
  ];

  const rows = [columns];

  // 工具函数
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

  // 处理每个商品
  for (const p of allProducts) {
    // 暂时跳过有变体的商品（当前店铺无变体，如需支持可后续扩展）
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

    // 价格处理：有促销价则使用促销价作为 Price，原价作为 Compare-at
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

    // 其他字段
    const cost = p.cost?.dollars ? p.cost.dollars.toFixed(2) : '';
    const sku = p.sku || '';
    const barcode = p.barcode || p.gtin || '';
    const taxable = p.taxable ? 'TRUE' : 'FALSE';
    const unlimited = p.unlimited_quantity;
    const tracker = unlimited ? '' : 'shopify';
    const qty = unlimited ? '' : (p.quantity ?? '');
    const continueSelling = unlimited ? 'CONTINUE' : 'DENY';
    const weightGrams = p.weight ? Math.round(p.weight * 1000) : 0; // 假设 API 中的 weight 为 kg

    // 图片（优先 cover_media_array，其次 media）
    const images = [];
    if (p.cover_media_array?.length) {
      p.cover_media_array.forEach(m => m.original_image_url && images.push(m.original_image_url));
    } else if (p.media?.length) {
      p.media.forEach(m => m.images?.original?.url && images.push(m.images.original.url));
    }

    // 主行
    const mainRow = {};
    mainRow['Title'] = title;
    mainRow['URL handle'] = handle;
    mainRow['Description'] = description;
    mainRow['Vendor'] = ''; // 请手动填写或修改此处为你的品牌名
    mainRow['Product category'] = ''; // 可手动填写 Shopify 分类
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

    // 额外图片行
    for (let i = 1; i < images.length; i++) {
      const imgRow = {};
      imgRow['URL handle'] = handle;
      imgRow['Product image URL'] = images[i];
      imgRow['Image position'] = (i + 1).toString();
      imgRow['Image alt text'] = title;
      rows.push(columns.map(col => imgRow[col] ?? ''));
    }
  }

  // 生成并下载 CSV
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

  console.log('导出完成！文件已下载：shopline_to_shopify_products.csv');
  alert(`成功导出 ${allProducts.length} 个商品（变体商品已跳过）`);
})();
