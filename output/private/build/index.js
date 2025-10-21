"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const block_basekit_server_api_1 = require("@lark-opdev/block-basekit-server-api");
const zod_1 = require("zod");
const { t } = block_basekit_server_api_1.field;
const ResponseEvent = zod_1.z.object({
    response: zod_1.z.string(),
});
// Error types for better categorization
var ErrorType;
(function (ErrorType) {
    ErrorType["VALIDATION"] = "VALIDATION_ERROR";
    ErrorType["NETWORK"] = "NETWORK_ERROR";
    ErrorType["AUTHENTICATION"] = "AUTHENTICATION_ERROR";
    ErrorType["API"] = "API_ERROR";
    ErrorType["UNKNOWN"] = "UNKNOWN_ERROR";
})(ErrorType || (ErrorType = {}));
const handleCompletion = async (api_key, model_name, prompt, context, size, stream, watermark, image, debugLog) => {
    let payload = {};
    if (model_name == "seedream-3-0-t2i-250415") {
        payload = {
            model: model_name,
            prompt: prompt.trim(),
            response_format: "url",
            watermark: watermark,
        };
    }
    else {
        payload = {
            model: model_name,
            prompt: prompt.trim(),
            sequential_image_generation: "disabled",
            response_format: "url",
            size: size,
            stream: stream,
            watermark: watermark,
            image: image
        };
    }
    try {
        debugLog("🚀 Starting image generation request...");
        const response = await context.fetch('https://ark.ap-southeast.bytepluses.com/api/v3/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${api_key}`
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorText = await response.text();
            let errorType = ErrorType.API;
            // Categorize HTTP errors
            if (response.status === 401) {
                errorType = ErrorType.AUTHENTICATION;
            }
            else if (response.status >= 500) {
                errorType = ErrorType.API;
            }
            const errorMessage = `API request failed (${response.status}): ${errorText}`;
            debugLog(`❌ ${errorMessage}`);
            return {
                url: null,
                error: errorMessage,
                errorType
            };
        }
        const data = await response.json();
        debugLog("📥 Received API response");
        // Validate response structure
        if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
            const errorMessage = 'Invalid API response: missing or empty data array';
            debugLog(`❌ ${errorMessage}`);
            return {
                url: null,
                error: errorMessage,
                errorType: ErrorType.API
            };
        }
        const imageUrl = data.data[0]?.url;
        if (!imageUrl) {
            const errorMessage = 'Invalid API response: missing image URL';
            debugLog(`❌ ${errorMessage}`);
            return {
                url: null,
                error: errorMessage,
                errorType: ErrorType.API
            };
        }
        debugLog("✅ Image generated successfully");
        return {
            url: imageUrl,
            error: null,
            errorType: ErrorType.API // Success case
        };
    }
    catch (error) {
        let errorType = ErrorType.UNKNOWN;
        let errorMessage = 'Unknown error occurred';
        // Categorize different types of errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorType = ErrorType.NETWORK;
            errorMessage = 'Network error: Unable to connect to the API service';
        }
        else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorType = ErrorType.NETWORK;
            errorMessage = 'Network error: Cannot resolve hostname or connection refused';
        }
        else if (error.message) {
            errorMessage = error.message;
        }
        debugLog(`❌ ${errorType}: ${errorMessage}`);
        return {
            url: null,
            error: errorMessage,
            errorType
        };
    }
};
// Add the domain names of the request interfaces via addDomainList
block_basekit_server_api_1.basekit.addDomainList(['ark.ap-southeast.bytepluses.com']);
block_basekit_server_api_1.basekit.addField({
    i18n: {
        messages: {
            'zh-CN': {},
            'en-US': {},
            'ja-JP': {},
        }
    },
    // Define the input parameters for the shortcut
    formItems: [
        {
            key: 'api_key',
            label: 'API Key',
            component: block_basekit_server_api_1.FieldComponent.Input,
            props: {
                placeholder: 'BytePlus API Key',
            },
            validator: {
                required: true,
            }
        },
        {
            key: 'model_name',
            label: 'Model Version',
            component: block_basekit_server_api_1.FieldComponent.SingleSelect,
            defaultValue: 'seedream-4-0-250828',
            props: {
                options: [
                    { label: 'seedream-4-0-250828', value: 'seedream-4-0-250828' },
                    { label: 'seedream-3-0-t2i-250415', value: 'seedream-3-0-t2i-250415' },
                ],
            },
            tooltips: [
                {
                    type: 'text',
                    content: 'seedream-3-0-t2i-250415 does not support reference image, stream, size selection'
                }
            ],
        },
        {
            key: 'prompt',
            label: 'Prompt',
            component: block_basekit_server_api_1.FieldComponent.Input,
            props: {
                placeholder: 'Input prompt here',
            },
            validator: {
                required: true,
            }
        },
        {
            key: 'attachments',
            label: 'Reference Image',
            component: block_basekit_server_api_1.FieldComponent.FieldSelect,
            props: {
                supportType: [block_basekit_server_api_1.FieldType.Attachment],
            },
        },
        {
            key: 'size',
            label: 'Size',
            component: block_basekit_server_api_1.FieldComponent.SingleSelect,
            defaultValue: '2K',
            props: {
                options: [
                    { label: '2K', value: '2K' },
                    { label: '4K', value: '4K' },
                ]
            },
        },
        {
            key: 'stream',
            label: 'Stream',
            defaultValue: false,
            component: block_basekit_server_api_1.FieldComponent.SingleSelect,
            props: {
                options: [
                    { label: 'True', value: true },
                    { label: 'False', value: false },
                ]
            },
        },
        {
            key: 'watermark',
            label: 'Watermark',
            defaultValue: false,
            component: block_basekit_server_api_1.FieldComponent.SingleSelect,
            props: {
                options: [
                    { label: 'True', value: true },
                    { label: 'False', value: false },
                ]
            },
        },
    ],
    resultType: {
        type: block_basekit_server_api_1.FieldType.Attachment,
    },
    execute: async (formItemParams, context) => {
        /** Use this method instead of console.log for easier log viewing */
        function debugLog(arg) {
            console.log(JSON.stringify({
                formItemParams,
                context,
                arg
            }));
        }
        const { prompt, api_key, size, stream, watermark, attachments, model_name } = formItemParams;
        // Extract image URL safely
        let image_url = null;
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            image_url = attachments[0]?.tmp_url;
        }
        try {
            debugLog("🎯 Starting image generation process...");
            const result = await handleCompletion(api_key, model_name?.value || 'seedream-4-0-250828', prompt, context, size?.value || '2K', stream || false, watermark || false, image_url, debugLog);
            // Handle different error types with appropriate responses
            if (result.error) {
                debugLog(`💥 Operation failed: ${result.errorType} - ${result.error}`);
                // Return different error codes based on error type
                let errorCode = block_basekit_server_api_1.FieldCode.Error;
                if (result.errorType === ErrorType.VALIDATION) {
                    errorCode = block_basekit_server_api_1.FieldCode.Error; // Validation errors should be shown to user
                }
                else if (result.errorType === ErrorType.AUTHENTICATION) {
                    errorCode = block_basekit_server_api_1.FieldCode.Error; // Auth errors should be shown to user
                }
                else if (result.errorType === ErrorType.NETWORK) {
                    errorCode = block_basekit_server_api_1.FieldCode.Error; // Network errors should be shown to user
                }
                return {
                    code: errorCode,
                    data: `Error: ${result.error}`
                };
            }
            // Success case - validate URL before returning
            if (!result.url) {
                debugLog("⚠️ No URL returned from API");
                return {
                    code: block_basekit_server_api_1.FieldCode.Error,
                    data: "Error: No image URL received from API"
                };
            }
            debugLog("🎉 Image generation completed successfully");
            return {
                code: block_basekit_server_api_1.FieldCode.Success,
                data: [
                    {
                        name: "generated_image.png",
                        content: result.url,
                        contentType: "attachment/url"
                    }
                ]
            };
        }
        catch (e) {
            debugLog(`💥 Unexpected error in execute function: ${e.message || e}`);
            return {
                code: block_basekit_server_api_1.FieldCode.Error,
                data: `Unexpected error: ${e.message || 'Unknown error occurred'}`
            };
        }
    },
});
exports.default = block_basekit_server_api_1.basekit;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxtRkFBNEc7QUFDNUcsNkJBQXdCO0FBQ3hCLE1BQU0sRUFBRSxDQUFDLEVBQUUsR0FBRyxnQ0FBSyxDQUFDO0FBRXBCLE1BQU0sYUFBYSxHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDN0IsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUU7Q0FDckIsQ0FBQyxDQUFDO0FBRUgsd0NBQXdDO0FBQ3hDLElBQUssU0FNSjtBQU5ELFdBQUssU0FBUztJQUNaLDRDQUErQixDQUFBO0lBQy9CLHNDQUF5QixDQUFBO0lBQ3pCLG9EQUF1QyxDQUFBO0lBQ3ZDLDhCQUFpQixDQUFBO0lBQ2pCLHNDQUF5QixDQUFBO0FBQzNCLENBQUMsRUFOSSxTQUFTLEtBQVQsU0FBUyxRQU1iO0FBUUQsTUFBTSxnQkFBZ0IsR0FBRyxLQUFLLEVBQzVCLE9BQWUsRUFDZixVQUFrQixFQUNsQixNQUFjLEVBQ2QsT0FBWSxFQUNaLElBQVksRUFDWixNQUFlLEVBQ2YsU0FBa0IsRUFDbEIsS0FBYSxFQUNiLFFBQTRCLEVBQ1IsRUFBRTtJQUV0QixJQUFJLE9BQU8sR0FBRyxFQUFFLENBQUE7SUFDaEIsSUFBSSxVQUFVLElBQUUseUJBQXlCLEVBQUUsQ0FBQztRQUMxQyxPQUFPLEdBQUc7WUFDUixLQUFLLEVBQUUsVUFBVTtZQUNqQixNQUFNLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRTtZQUNyQixlQUFlLEVBQUUsS0FBSztZQUN0QixTQUFTLEVBQUUsU0FBUztTQUNyQixDQUFBO0lBQ0gsQ0FBQztTQUFNLENBQUM7UUFDTixPQUFPLEdBQUc7WUFDUixLQUFLLEVBQUUsVUFBVTtZQUNqQixNQUFNLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRTtZQUNyQiwyQkFBMkIsRUFBRSxVQUFVO1lBQ3ZDLGVBQWUsRUFBRSxLQUFLO1lB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