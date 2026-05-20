export const dictionaries = {
  ja: {
    common: {
      loading: "読み込み中...",
      error: "エラーが発生しました",
      save: "保存",
      cancel: "キャンセル",
      delete: "削除",
      confirm: "確認",
      close: "閉じる",
      submit: "送信",
      next: "次へ",
      back: "戻る",
      search: "検索",
      filter: "フィルター",
      sort: "並び替え",
      empty: "データがありません",
      noResults: "結果が見つかりませんでした",
      retry: "再試行",
      privacyNotice: "プライバシー設定でオプトアウト可能",
    },
    a11y: {
      srOnly: "スクリーンリーダー専用",
      skipLink: "本文へ移動",
      loadingAnnouncement: "読み込み中です。しばらくお待ちください。",
      errorAnnouncement: "エラーが発生しました。内容を確認してください。",
      successAnnouncement: "処理が完了しました。",
    },
    errors: {
      required: "必須項目です",
      minLength: "{min}文字以上入力してください",
      maxLength: "{max}文字以下で入力してください",
      invalidFormat: "形式が正しくありません",
      networkError: "ネットワークエラーが発生しました。再試行してください。",
    },
  },
  en: {
    common: {
      loading: "Loading...",
      error: "An error occurred",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      confirm: "Confirm",
      close: "Close",
      submit: "Submit",
      next: "Next",
      back: "Back",
      search: "Search",
      filter: "Filter",
      sort: "Sort",
      empty: "No data available",
      noResults: "No results found",
      retry: "Retry",
      privacyNotice: "You can opt out in privacy settings",
    },
    a11y: {
      srOnly: "Screen reader only",
      skipLink: "Skip to main content",
      loadingAnnouncement: "Loading. Please wait.",
      errorAnnouncement: "An error occurred. Please check the content.",
      successAnnouncement: "Process completed successfully.",
    },
    errors: {
      required: "This field is required",
      minLength: "Please enter at least {min} characters",
      maxLength: "Please enter no more than {max} characters",
      invalidFormat: "Invalid format",
      networkError: "A network error occurred. Please try again.",
    },
  },
};

export type Locale = "ja" | "en";
export type Dictionary = typeof dictionaries.ja;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.ja;
}
