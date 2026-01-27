// 图片处理 Web Worker
// 处理图片以适应主题颜色

// 辅助函数：将十六进制颜色转换为RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// 处理图片数据
function processImageData(imageData, targetColor) {
    const data = imageData.data;
    let targetR, targetG, targetB;
    
    // 解析目标颜色
    if (targetColor.startsWith('rgb')) {
        const rgb = targetColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            targetR = parseInt(rgb[0]);
            targetG = parseInt(rgb[1]);
            targetB = parseInt(rgb[2]);
        } else {
            targetR = 51;
            targetG = 51;
            targetB = 51;
        }
    } else if (targetColor.startsWith('#')) {
        const rgb = hexToRgb(targetColor);
        if (rgb) {
            targetR = rgb.r;
            targetG = rgb.g;
            targetB = rgb.b;
        } else {
            targetR = 51;
            targetG = 51;
            targetB = 51;
        }
    } else {
        targetR = 51;
        targetG = 51;
        targetB = 51;
    }
    
    // 计算目标颜色的亮度
    const targetBrightness = 0.299 * targetR + 0.587 * targetG + 0.114 * targetB;
    
    // 第一遍：统计原图的亮度分布
    let darkPixelCount = 0;
    let totalPixelCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;
        
        totalPixelCount++;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const sourceBrightness = 0.299 * r + 0.587 * g + 0.114 * b;
        
        if (sourceBrightness < 100) {
            darkPixelCount++;
        }
    }
    
    const isDarkImage = darkPixelCount > totalPixelCount * 0.5;
    
    // 第二遍：处理图片
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        if (a === 0) continue;
        
        const sourceBrightness = 0.299 * r + 0.587 * g + 0.114 * b;
        
        if (isDarkImage) {
            // 黑色原图策略
            if (sourceBrightness < 50) {
                data[i] = targetR;
                data[i + 1] = targetG;
                data[i + 2] = targetB;
            } else if (sourceBrightness < 128) {
                const darkRatio = sourceBrightness / 128;
                const colorRatio = 1 - darkRatio;
                data[i] = Math.round(targetR * colorRatio + sourceBrightness * (1 - colorRatio));
                data[i + 1] = Math.round(targetG * colorRatio + sourceBrightness * (1 - colorRatio));
                data[i + 2] = Math.round(targetB * colorRatio + sourceBrightness * (1 - colorRatio));
            }
            // 浅色部分保持不变
        } else {
            // 普通图片策略
            let sourceBrightnessNormalized = sourceBrightness / 255;
            sourceBrightnessNormalized = Math.pow(sourceBrightnessNormalized, 0.8);
            
            if (targetBrightness > 180) {
                const enhancedRatio = Math.pow(sourceBrightnessNormalized, 0.6);
                data[i] = Math.round(targetR * enhancedRatio);
                data[i + 1] = Math.round(targetG * enhancedRatio);
                data[i + 2] = Math.round(targetB * enhancedRatio);
            } else if (targetBrightness < 80) {
                const enhancedRatio = Math.pow(sourceBrightnessNormalized, 0.9);
                data[i] = Math.round(targetR * enhancedRatio);
                data[i + 1] = Math.round(targetG * enhancedRatio);
                data[i + 2] = Math.round(targetB * enhancedRatio);
            } else {
                data[i] = Math.round(targetR * sourceBrightnessNormalized);
                data[i + 1] = Math.round(targetG * sourceBrightnessNormalized);
                data[i + 2] = Math.round(targetB * sourceBrightnessNormalized);
            }
        }
    }
    
    return imageData;
}

// 监听消息
self.onmessage = function(e) {
    const { imageData, targetColor } = e.data;
    
    try {
        const processedData = processImageData(imageData, targetColor);
        self.postMessage({ success: true, imageData: processedData });
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};
