import React from 'react';

type Props = {
  key: string;
  author: string;
  avatarText: string;
  avatarUrl?: string;
  color: string;
  text: string;
  isUser?: boolean;
};

export default function MessageBubble({ author, avatarText, avatarUrl, color, text, isUser }: Props) {
  return (
    <div className={`row ${isUser ? 'reverse' : ''}`}>
      <div className="avatar" style={{ backgroundColor: color }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={author} className="avatar-img" />
        ) : (
          avatarText
        )}
      </div>
      <div className={`bubble ${isUser ? 'user' : 'persona'}`}>
        <div className="author">{author}</div>
        <div>{text}</div>
      </div>
    </div>
  );
}

