import { basekit, FieldType, field, FieldComponent, FieldCode } from '@lark-opdev/block-basekit-server-api';
import { z } from 'zod';
const { t } = field;

const ResponseEvent = z.object({
  response: z.string(),
});

// Error types for better categorization
enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  NETWORK = 'NETWORK_ERROR', 
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  API = 'API_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

interface ApiResult {
  url: string | null;
  error: string | null;
  errorType: ErrorType;
}

const handleCompletion = async (
  api_key: string,
  model_name: string,
  prompt: string,
  context: any,
  size: string,
  stream: boolean,
  watermark: boolean,
  image: string,
  debugLog: (arg: any) => void
): Promise<ApiResult> => {

  let payload = {}
  if (model_name=="seedream-3-0-t2i-250415") {
    payload = {
      model: model_name,
      prompt: prompt.trim(),
      response_format: "url",
      watermark: watermark,
    }
  } else {
    payload = {
      model: model_name,
      prompt: prompt.trim(),
      sequential_image_generation: "disabled",
      response_format: "url",
      size: size,
      stream: stream,
      watermark: watermark,
      image: image
    }
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
      } else if (response.status >= 500) {
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

  } catch (error: any) {
    let errorType = ErrorType.UNKNOWN;
    let errorMessage = 'Unknown error occurred';

    // Categorize different types of errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorType = ErrorType.NETWORK;
      errorMessage = 'Network error: Unable to connect to the API service';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorType = ErrorType.NETWORK;
      errorMessage = 'Network error: Cannot resolve hostname or connection refused';
    } else if (error.message) {
      errorMessage = error.message;
    }

    debugLog(`❌ ${errorType}: ${errorMessage}`);
    
    return {
      url: null,
      error: errorMessage,
      errorType
    };
  }
}

// Add the domain names of the request interfaces via addDomainList
basekit.addDomainList(['ark.ap-southeast.bytepluses.com']);

basekit.addField({
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
      component: FieldComponent.Input,
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
      component: FieldComponent.SingleSelect,
      defaultValue: 'seedream-4-0-250828',
      props: {
        options: [
          { label: 'seedream-4-0-250828', value: 'seedream-4-0-250828'},
          { label: 'seedream-3-0-t2i-250415', value: 'seedream-3-0-t2i-250415'},
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
      component: FieldComponent.Input,
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
      component: FieldComponent.FieldSelect,
      props: {
        supportType: [FieldType.Attachment],
      },
    },
    {
      key: 'size',
      label: 'Size',
      component: FieldComponent.SingleSelect,
      defaultValue: '2K',
      props: {
        options: [
          { label: '2K', value: '2K'},
          { label: '4K', value: '4K'},
        ]
      },
    },
    {
      key: 'stream',
      label: 'Stream',
      defaultValue: false,
      component: FieldComponent.SingleSelect,
      props: {
        options: [
          { label: 'True', value: true},
          { label: 'False', value: false},
        ]
      },
    },
    {
      key: 'watermark',
      label: 'Watermark',
      defaultValue: false,
      component: FieldComponent.SingleSelect,
      props: {
        options: [
          { label: 'True', value: true},
          { label: 'False', value: false},
        ]
      },
    },
  ],
  resultType: {
    type: FieldType.Attachment,
  },
  execute: async (formItemParams, context) => {
    /** Use this method instead of console.log for easier log viewing */
    function debugLog(arg: any) {
      console.log(JSON.stringify({
        formItemParams,
        context,
        arg
      }))
    }
    
    const { prompt, api_key, size, stream, watermark, attachments, model_name } = formItemParams;

    // Extract image URL safely
    let image_url = null;
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      image_url = attachments[0]?.tmp_url;
    }

    try {
      debugLog("🎯 Starting image generation process...");
      
      const result = await handleCompletion(
        api_key,
        model_name?.value || 'seedream-4-0-250828',
        prompt,
        context,
        size?.value || '2K',
        stream || false,
        watermark || false,
        image_url,
        debugLog
      );

      // Handle different error types with appropriate responses
      if (result.error) {
        debugLog(`💥 Operation failed: ${result.errorType} - ${result.error}`);
        
        // Return different error codes based on error type
        let errorCode = FieldCode.Error;
        if (result.errorType === ErrorType.VALIDATION) {
          errorCode = FieldCode.Error; // Validation errors should be shown to user
        } else if (result.errorType === ErrorType.AUTHENTICATION) {
          errorCode = FieldCode.Error; // Auth errors should be shown to user
        } else if (result.errorType === ErrorType.NETWORK) {
          errorCode = FieldCode.Error; // Network errors should be shown to user
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
          code: FieldCode.Error,
          data: "Error: No image URL received from API"
        };
      }

      debugLog("🎉 Image generation completed successfully");
      return {
        code: FieldCode.Success,
        data: [
          {
            name: "generated_image.png",
            content: result.url,
            contentType: "attachment/url"
          }
        ]
      };
      
    } catch (e: any) {
      debugLog(`💥 Unexpected error in execute function: ${e.message || e}`);
      return {
        code: FieldCode.Error,
        data: `Unexpected error: ${e.message || 'Unknown error occurred'}`
      };
    }
  },
});
export default basekit;