import { JsonDB } from 'node-json-db';
import { Config } from 'node-json-db/dist/lib/JsonDBConfig.js';

const eventDB = new JsonDB(new Config('db/eventMessageDB.json', true, true, '/'));
const memberDB = new JsonDB(new Config('db/memberDB.json', true, true, '/'));
const contextDB = new JsonDB(new Config('db/contextDB.json', true, true, '/'));
const messageDB = new JsonDB(new Config('db/messageDB.json', true, true, '/'));

let count = 1;
let eventName;
let eventDate;
let memberName;
let memberId;

const isGroup = (event) => {
  return event.source.type === "group";
}

// テキストメッセージの処理をする関数
export const textEvent = async (event, client) => {
  let message;
  let { userId } = event.source;
  if (isGroup(event)) {
    userId = event.source.groupId;
  }
  // テキストメッセージの処理をする関数
  let eventContextData;
  let eventMemoData;
  try {
    eventContextData = contextDB.getData(`/${userId}/context`);
  } catch (_) {
    eventContextData = undefined;
  }
  try {
    eventMemoData = eventDB.getData(`/${userId}/event/`);
  } catch (_) {
    eventMemoData = undefined;
  }
  // contextDataで条件分岐
  switch (eventContextData) {
    // もしそのユーザーのcontextがmemoModeだったら
    case 'eventMemoMode': {
      // メッセージをDBへ保存
      eventDate = event.message.text;
      // contextをDBから削除
      contextDB.delete(`/${userId}/context`);
      // 返信するメッセージをreturnする
      contextDB.push(`/${userId}/context`, 'eventMemoMode2');
      return {
        type: 'text',
        text: `${event.message.text}"日に何をひらきますか?`,
      };
    }
    case 'eventMemoMode2': {
      // メッセージをDBへ保存
      eventName = event.message.text;
      // eventMessageDB.push(`/${userId}/event/${countE}`, { eventDate: `${event.message.text}` });
      eventDB.push(`/${userId}/event/${eventDate}`, { eventName, eventDate });
      // contextをDBから削除
      contextDB.delete(`/${userId}/context`);
      // 返信するメッセージをreturnする
      return {
        type: 'text',
        text: `"${eventDate}"日に${eventName}を追加しました`,
      };
    }
    case 'eventRemMode': {
      eventDB.delete(`/${userId}/event/${event.message.text}`);
      contextDB.delete(`/${userId}/context`);
      return {
        type: 'text',
        text: `${event.message.text}日の予定を削除しました`,
      };
    }
    default:
      break;
  }
  // DBからユーザーのデータを取得
  let contextData;
  let memoData;
  let memberData;
  try {
    contextData = contextDB.getData(`/${userId}/context`);
  } catch (_) {
    contextData = undefined;
  }
  try {
    memoData = messageDB.getData(`/${userId}/memo`);
  } catch (_) {
    memoData = undefined;
  }
  try {
    memberData = memberDB.getData(`/${userId}/member`);
  } catch (_) {
    memberData = undefined;
  }

  // contextDataで条件分岐
  switch (contextData) {
    // もしそのユーザーのcontextがmemoModeだったら
    case 'memoMode': {
      // すでに保存されているメモがDBにある場合
      if (memoData) {
        // すでにあるmemoカラムに新しいメッセージを追加する
        memoData.push(`\n${event.message.text}`);
        // メッセージをDBへ保存
        messageDB.push(`/${userId}/memo`, memoData);
      } else {
        // memoカラムを作成してDBに保存
        messageDB.push(`/${userId}/memo`, [event.message.text]);
      }
      // contextをDBから削除
      contextDB.delete(`/${userId}/context`);
      // 返信するメッセージをreturnする
      return {
        type: 'text',
        text: `${event.message.text}というメッセージをdbに追加しました`,
      };
    }
    case 'addMemberName': {
      memberName = `${event.message.text}`;
      contextDB.push(`/${userId}/context`, 'addMemberPosition');
      return {
        type: 'text',
        text: `追加するメンバーの役職を入力してください。`,
      };
    }
    case 'addMemberPosition': {
      memberDB.push(`/${userId}/member/${count}`, { id: `${count++}`, name: `${memberName}`, Position: `${event.message.text}` }, false);
      // contextをDBから削除
      contextDB.delete(`/${userId}/context`);
      // 返信するメッセージをreturnする
      return {
        type: 'text',
        text: `${memberName} さんをメンバーに追加しました。`,
      };
    }
    case 'editMember': {
      memberId = `${event.message.text}`;
      contextDB.push(`/${userId}/context`, 'editMemberName');
      return {
        type: 'text',
        text: `新しい名前を入力してください。`,
      };
    }
    case 'editMemberName': {
      memberName = `${event.message.text}`;
      contextDB.push(`/${userId}/context`, 'editMemberPosition');
      return {
        type: 'text',
        text: `新しい役職を入力してください。`,
      };
    }
    case 'editMemberPosition': {
      memberDB.push(`/${userId}/member/${memberId}`, { name: `${memberName}`, Position: `${event.message.text}` }, false);
      // contextをDBから削除
      contextDB.delete(`/${userId}/context`);
      // 返信するメッセージをreturnする
      return {
        type: 'text',
        text: `${memberName} さんに変更しました。`,
      };
    }
    case 'deleteMember': {
      let deleteMemberName;
      try {
        deleteMemberName = memberDB.getData(`/${userId}/member/${event.message.text}/name`);
      } catch (_) {
        deleteMemberName = undefined;
      }
      if (deleteMemberName) {
        memberDB.delete(`/${userId}/member/${event.message.text}`);
        contextDB.delete(`/${userId}/context`);
        return {
          type: 'text',
          text: `${deleteMemberName}さんをメンバーから削除しました。`,
        };
      } else {
        return {
          type: 'text',
          text: `IDが${event.message.text}のメンバーは存在しません。`,
        };
      }
    }
    case 'getMemberId': {
      memberId = `${event.message.text}`;
      contextDB.delete(`/${userId}/context`);
      message = {
        type: 'text',
        text: 'メンバーの参加可能日の設定を行います。',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'message',
                label: '追加',
                text: '参加可能日追加',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '削除',
                text: '参加可能日削除',
              },
            },
          ],
        },
      };
      return message;
    }
    case 'addavailabledate': {
      memberDB.push(`/${userId}/member/${memberId}/availabledate/${event.message.text}`, { date: `${event.message.text}` }, false);
      contextDB.delete(`/${userId}/context`);
      return {
        type: 'text',
        text: `追加しました。`,
      };
    }
    case 'deleteavailabledate': {
      memberDB.push(`/${userId}/member/${memberId}/availabledate/${event.message.text}`);
      contextDB.delete(`/${userId}/context`);
      return {
        type: 'text',
        text: `削除しました。`,
      };
    }
    default:
      break;
  }
  // メッセージのテキストごとに条件分岐
  switch (event.message.text) {
    // 'メモ'というメッセージが送られてきた時
    case 'メモ': {
      // メモのデータがDBに存在する時
      if (memoData) {
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: `メモには以下のメッセージが保存されています\n\n${memoData}`,
        };
      } else {
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: 'メモが存在しません',
        };
      }
      break;
    }
    // 'メモ開始'というメッセージが送られてきた時
    case 'メモ開始': {
      // DBにcontextを追加
      contextDB.push(`/${userId}/context`, 'memoMode');
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'メモモードを開始しました',
      };
      break;
    }

    // 'Read'というメッセージが送られてきた時
    case 'Read': {
      // DBにtestDataが存在しているかをチェック
      try {
        // DBからデータを取得（データがない場合は例外が投げられるのでcatchブロックに入る）
        const dbData = memberDB.getData(`/${userId}/testData`);
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: `DBには以下のデータが保存されています\n\n${JSON.stringify(dbData)}`,
        };
      } catch (_) {
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: 'DBにデータが保存されていません',
        };
      }
      break;
    }

    // 最初の設定画面
    case '日程調整': {
      message = {
        type: 'template',
        altText: 'ボタンテンプレート',
        template: {
          type: 'buttons',
          thumbnailImageUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
          imageAspectRatio: 'rectangle',
          imageSize: 'cover',
          imageBackgroundColor: '#FFFFFF',
          title: '日程調整',
          text: '各種設定',
          defaultAction: {
            type: 'uri',
            label: 'View detail',
            uri: 'https://shinbunbun.info/images/photos/',
          },
          actions: [
            {
              type: 'message',
              label: 'イベントの設定',
              text: 'イベントの設定',
            },
            {
              type: 'message',
              label: 'メンバーの設定',
              text: 'メンバーの設定',
            },
            {
              type: 'message',
              label: 'テンプレートの設定',
              text: 'テンプレートの設定',
            },
            {
              type: 'message',
              label: 'その他設定',
              text: 'その他の設定',
            },
          ],
        },
      };
      break;
    }

    // イベントの設定
    case 'イベントの設定': {
      message = {
        type: 'text',
        text: 'イベントの操作を選んでください',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'message',
                text: 'イベントの追加',
                label: 'イベントの追加',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                text: 'イベントの削除',
                label: 'イベントの削除',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                text: 'イベントの一括削除',
                label: 'イベントの一括削除',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                text: 'イベントの編集',
                label: 'イベントの編集',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                text: 'イベントの一覧',
                label: 'イベントの一覧',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                text: 'イベントの通知',
                label: 'イベントの通知',
              },
            },
          ],
        },
      };
      break;
    }

    case 'イベントの一覧': {
      // メモのデータがDBに存在する時
      if (eventMemoData) {
        let eventTmp;
        let Data = null;
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: '以下のイベントが保存されています\n',
        };
        for (let i = 1; i <= 31; i++) {
          try {
            eventTmp = eventDB.getData(`/${userId}/event/${i}/eventName`);
          } catch (_) {
            eventDB.push(`/${userId}/event/${i}`, '休み');
          }
          if (i === 1) {
            Data = eventDB.getData(`/${userId}/event/${i}`);
          } else {
            Data += `\n${eventDB.getData(`/${userId}/event/${i}`)}`;
          }
        }
        message = {
          type: 'text',
          text: Data,
        };
      } else {
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: 'イベントが存在しません',
        };
      }
      break;
    }
    // 'イベントの追加'というメッセージが送られてきた時
    case 'イベントの追加': {
      // DBにcontextを追加
      contextDB.push(`/${userId}/context`, 'eventMemoMode');
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'イベントの日付を入力してください',
      };
      break;
    }
    case 'イベントの削除': {
      contextDB.push(`/${userId}/context`, 'eventRemMode');
      message = {
        type: 'text',
        text: '削除する日付を入力してください',
      };
      break;
    }
    case 'イベントの一括削除': {
      eventDB.delete(`/${userId}/event/`);
      message = {
        type: 'text',
        text: 'すべてのイベントを削除しました',
      };
      break;
    }

    case 'メンバーの設定': {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'メンバーの設定を行います。',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'message',
                label: '追加',
                text: 'メンバーの追加',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '削除',
                text: 'メンバーの削除',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '編集',
                text: 'メンバーの編集',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '一覧',
                text: 'メンバーの一覧',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '参加可能日設定',
                text: 'メンバーの参加可能日設定',
              },
            },
          ],
        },
      };
      break;
    }

    case 'メンバーの参加可能日設定': {
      contextDB.push(`/${userId}/context`, 'getMemberId');
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: '参加可能日を設定するメンバーのIDを入力してください。',
      };
      break;
    }

    case '参加可能日追加': {
      contextDB.push(`/${userId}/context`, 'addavailabledate');
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: '追加する参加可能日を入力してください。',
      };
      break;
    }

    case '参加可能日削除': {
      contextDB.push(`/${userId}/context`, 'deleteavailabledate');
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: '削除する参加可能日を入力してください。',
      };
      break;
    }

    case 'メンバーの追加': {
      contextDB.push(`/${userId}/context`, 'addMemberName');
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: '追加するメンバーの名前を入力してください。',
      };
      break;
    }

    case 'メンバーの編集': {
      if (memberData) {
        contextDB.push(`/${userId}/context`, 'editMember');
        // 返信するメッセージを作成
        let id;
        let member;
        let Data;
        for (let i = 1; i <= 3; i++) {
          try {
            id = memberDB.getData(`/${userId}/member/${i}/id`);
            member = memberDB.getData(`/${userId}/member/${i}/name`);
          } catch (_) {
            member = undefined;
          }
          if (member) {
            if (i == 1) {
              Data = "ID:" + id + " " + member + " さん";
            } else {
              Data += "\n" + "ID:" + id + " " + member + " さん";
            }
          }
        }
        message = {
          type: 'text',
          text: `編集するメンバーのIDを入力してください。\n${Data}`,
        };
      } else {
        message = {
          type: 'text',
          text: 'メンバーが存在しません',
        };
      }
      break;
    }

    case 'メンバーの削除': {
      if (memberData) {
        contextDB.push(`/${userId}/context`, 'deleteMember');
        // 返信するメッセージを作成
        let id;
        let member;
        let Data;
        for (let i = 1; i <= 3; i++) {
          try {
            id = memberDB.getData(`/${userId}/member/${i}/id`);
            member = memberDB.getData(`/${userId}/member/${i}/name`);
          } catch (_) {
            member = undefined;
          }
          if (member) {
            if (i == 1) {
              Data = "ID:" + id + " " + member + " さん";
            } else {
              Data += "\n" + "ID:" + id + " " + member + " さん";
            }
          }
        }
        message = {
          type: 'text',
          text: `削除するメンバーのIDを入力してください\n${Data}`,
        };
        break;
      } else {
        message = {
          type: 'text',
          text: 'メンバーが存在しません',
        };
      }
    }

    case '削除': {
      memberDB.delete('/');
      count = 1;
      break;
    }

    case 'メンバーの一覧': {
      if (memberData) {
        // 返信するメッセージを作成
        let id;
        let member;
        let Data;
        for (let i = 1; i <= 3; i++) {
          try {
            id = memberDB.getData(`/${userId}/member/${i}/id`);
            member = memberDB.getData(`/${userId}/member/${i}/name`);
          } catch (_) {
            member = undefined;
          }
          if (member) {
            if (i == 1) {
              Data = "ID:" + id + " " + member + " さん";
            } else {
              Data += "\n" + "ID:" + id + " " + member + " さん";
            }
          }
        }
        message = {
          type: 'text',
          text: `日程調整Botには以下のメンバーが登録されています。\n${Data}`,
        };
      } else {
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: 'メンバーが存在しません',
        };
      }
      break;
    }

    // 'こんにちは'というメッセージが送られてきた時
    case 'こんにちは': {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'Hello, world',
      };
      break;
    }
    // '複数メッセージ'というメッセージが送られてきた時
    case '複数メッセージ': {
      // 返信するメッセージを作成
      message = [
        {
          type: 'text',
          text: 'Hello, user',
        },
        {
          type: 'text',
          text: 'May I help you?',
        },
      ];
      break;
    }
    // 'クイックリプライ'というメッセージが送られてきた時
    case 'クイックリプライ': {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'クイックリプライ（以下のアクションはクイックリプライ専用で、他のメッセージタイプでは使用できません）',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'camera',
                label: 'カメラを開く',
              },
            },
            {
              type: 'action',
              action: {
                type: 'cameraRoll',
                label: 'カメラロールを開く',
              },
            },
            {
              type: 'action',
              action: {
                type: 'location',
                label: '位置情報画面を開く',
              },
            },
          ],
        },
      };
      break;
    }
    // 'スタンプメッセージ'というメッセージが送られてきた時
    case 'スタンプメッセージ': {
      // 返信するメッセージを作成
      message = {
        type: 'sticker',
        packageId: '446',
        stickerId: '1988',
      };
      break;
    }
    // '画像メッセージ'というメッセージが送られてきた時
    case '画像メッセージ': {
      // 返信するメッセージを作成
      message = {
        type: 'image',
        originalContentUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
        previewImageUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
      };
      break;
    }
    // '音声メッセージ'というメッセージが送られてきた時
    case '音声メッセージ': {
      // 返信するメッセージを作成
      message = {
        type: 'audio',
        originalContentUrl:
          'https://github.com/shinbunbun/aizuhack-bot/blob/master/media/demo.m4a?raw=true',
        duration: 6000,
      };
      break;
    }
    // '動画メッセージ'というメッセージが送られてきた時
    case '動画メッセージ': {
      // 返信するメッセージを作成
      message = {
        type: 'video',
        originalContentUrl: 'https://github.com/shinbunbun/aizuhack-bot/blob/master/media/demo.mp4?raw=true',
        previewImageUrl: 'https://raw.githubusercontent.com/shinbunbun/aizuhack-bot/master/media/thumbnail.jpg?raw=true',
      };
      break;
    }
    // '位置情報メッセージ'というメッセージが送られてきた時
    case '位置情報メッセージ': {
      // 返信するメッセージを作成
      message = {
        type: 'location',
        title: 'my location',
        address: '〒160-0004 東京都新宿区四谷一丁目6番1号',
        latitude: 35.687574,
        longitude: 139.72922,
      };
      break;
    }
    // 'イメージマップメッセージ'というメッセージが送られてきた時
    case 'イメージマップメッセージ': {
      // イメージマップの画像の作成方法には細かい指定があります。参考→https://developers.line.biz/ja/reference/messaging-api/#imagemap-message
      message = [
        {
          type: 'imagemap',
          baseUrl:
            'https://github.com/shinbunbun/aizuhack-bot/blob/master/media/imagemap.png?raw=true',
          altText: 'This is an imagemap',
          baseSize: {
            width: 1686,
            height: 948,
          },
          actions: [
            {
              type: 'uri',
              area: {
                x: 590,
                y: 179,
                width: 511,
                height: 585,
              },
              linkUri: 'https://shinbunbun.info/about/',
            },
            {
              type: 'message',
              area: {
                x: 0,
                y: 0,
                width: 458,
                height: 948,
              },
              text: 'しんぶんぶん！！！',
            },
            {
              type: 'message',
              area: {
                x: 1230,
                y: 0,
                width: 456,
                height: 948,
              },
              text: 'しんぶんぶん！！！',
            },
          ],
        },
        {
          type: 'text',
          text: '画像の色々なところをタップしてみよう！',
        },
      ];
      break;
    }
    // 'ボタンテンプレート'というメッセージが送られてきた時
    case 'ボタンテンプレート': {
      // 返信するメッセージを作成
      message = {
        type: 'template',
        altText: 'ボタンテンプレート',
        template: {
          type: 'buttons',
          thumbnailImageUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
          imageAspectRatio: 'rectangle',
          imageSize: 'cover',
          imageBackgroundColor: '#FFFFFF',
          title: 'ボタンテンプレート',
          text: 'ボタンだお',
          defaultAction: {
            type: 'uri',
            label: 'View detail',
            uri: 'https://shinbunbun.info/images/photos/',
          },
          actions: [
            {
              type: 'postback',
              label: 'ポストバックアクション',
              data: 'button-postback',
            },
            {
              type: 'message',
              label: 'メッセージアクション',
              text: 'button-message',
            },
            {
              type: 'uri',
              label: 'URIアクション',
              uri: 'https://shinbunbun.info/',
            },
            {
              type: 'datetimepicker',
              label: '日時選択アクション',
              data: 'button-date',
              mode: 'datetime',
              initial: '2021-06-01t00:00',
              max: '2022-12-31t23:59',
              min: '2021-06-01t00:00',
            },
          ],
        },
      };
      break;
    }
    // '確認テンプレート'というメッセージが送られてきた時
    case '確認テンプレート': {
      // 返信するメッセージを作成
      message = {
        type: 'template',
        altText: '確認テンプレート',
        template: {
          type: 'confirm',
          text: '確認テンプレート',
          actions: [
            {
              type: 'message',
              label: 'はい',
              text: 'yes',
            },
            {
              type: 'message',
              label: 'いいえ',
              text: 'no',
            },
          ],
        },
      };
      break;
    }
    // 'カルーセルテンプレート'というメッセージが送られてきた時
    case 'カルーセルテンプレート': {
      // 返信するメッセージを作成
      message = {
        type: 'template',
        altText: 'カルーセルテンプレート',
        template: {
          type: 'carousel',
          columns: [
            {
              thumbnailImageUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
              imageBackgroundColor: '#FFFFFF',
              title: 'タイトル1',
              text: '説明1',
              defaultAction: {
                type: 'uri',
                label: 'View detail',
                uri: 'https://shinbunbun.info/',
              },
              actions: [
                {
                  type: 'postback',
                  label: 'ポストバック',
                  data: 'postback-carousel-1',
                },
                {
                  type: 'uri',
                  label: 'URIアクション',
                  uri: 'https://shinbunbun.info/',
                },
              ],
            },
            {
              thumbnailImageUrl:
                'https://shinbunbun.info/images/photos/10.jpeg',
              imageBackgroundColor: '#FFFFFF',
              title: 'タイトル2',
              text: '説明2',
              defaultAction: {
                type: 'uri',
                label: 'View detail',
                uri: 'https://shinbunbun.info/',
              },
              actions: [
                {
                  type: 'postback',
                  label: 'ポストバック',
                  data: 'postback-carousel-2',
                },
                {
                  type: 'uri',
                  label: 'URIアクション',
                  uri: 'https://shinbunbun.info/',
                },
              ],
            },
          ],
          imageAspectRatio: 'rectangle',
          imageSize: 'cover',
        },
      };
      break;
    }
    // '画像カルーセルテンプレート'というメッセージが送られてきた時
    case '画像カルーセルテンプレート': {
      // 返信するメッセージを作成
      message = {
        type: 'template',
        altText: '画像カルーセルテンプレート',
        template: {
          type: 'image_carousel',
          columns: [
            {
              imageUrl: 'https://shinbunbun.info/images/photos/4.jpeg',
              action: {
                type: 'postback',
                label: 'ポストバック',
                data: 'image-carousel-1',
              },
            },
            {
              imageUrl: 'https://shinbunbun.info/images/photos/5.jpeg',
              action: {
                type: 'message',
                label: 'メッセージ',
                text: 'いえい',
              },
            },
            {
              imageUrl: 'https://shinbunbun.info/images/photos/7.jpeg',
              action: {
                type: 'uri',
                label: 'URIアクション',
                uri: 'https://shinbunbun.info/',
              },
            },
          ],
        },
      };
      break;
    }
    // 'Flex Message'というメッセージが送られてきた時
    case 'Flex Message': {
      // 返信するメッセージを作成
      message = {
        type: 'flex',
        altText: 'Flex Message',
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'Flex Message',
                color: '#FFFFFF',
                weight: 'bold',
              },
            ],
          },
          hero: {
            type: 'image',
            url: 'https://pbs.twimg.com/profile_images/1236928986212478976/wDa51i9T_400x400.jpg',
            size: 'xl',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'しんぶんぶん',
                size: 'xl',
                weight: 'bold',
                align: 'center',
              },
              {
                type: 'text',
                text: '会津大学学部一年',
                align: 'center',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'uri',
                      label: 'ホームページ',
                      uri: 'https://shinbunbun.info/',
                    },
                    style: 'primary',
                    offsetBottom: '10px',
                  },
                  {
                    type: 'button',
                    action: {
                      type: 'uri',
                      label: 'Twitter',
                      uri: 'https://twitter.com/shinbunbun_',
                    },
                    style: 'primary',
                    color: '#1DA1F2',
                  },
                ],
                paddingTop: '10px',
              },
            ],
          },
          styles: {
            header: {
              backgroundColor: '#008282',
            },
          },
        },
      };
      break;
    }
    // 'プロフィール'というメッセージが送られてきた時
    case 'プロフィール': {
      // ユーザーのプロフィール情報を取得
      const profile = await client.getProfile(event.source.userId);
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: `あなたの名前: ${profile.displayName} \nユーザーID: ${profile.userId} \nプロフィール画像のURL: ${profile.pictureUrl} \nステータスメッセージ: ${profile.statusMessage} `,
      };
      break;
    }
    // 'ここはどこ'というメッセージが送られてきた時
    case 'ここはどこ': {
      // 送信元がユーザーとの個チャだった場合
      if (event.source.type === 'user') {
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: 'ここは個チャだよ！',
        };
        // 送信元がグループだった場合
      } else if (event.source.type === 'group') {
        // 返信するメッセージを作成
        message = {
          type: 'text',
          text: 'ここはグループだよ！',
        };
      }
      break;
    }
    // 上で条件分岐した以外のメッセージが送られてきた時
    default: {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: `受け取ったメッセージ: ${event.message.text} \nそのメッセージの返信には対応してません...`,
      };
      break;
    }
  }
  return message;
};
