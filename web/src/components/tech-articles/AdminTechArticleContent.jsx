import React from "react";
import "../../styles/techArticlesReset.css";
import "../../styles/techArticlesAdmin.css";
import "../../styles/techArticlesAdminAlign.css";

function AdminTechArticleContent({ children }) {
  return (
    <div className="ta-admin">

      <div className="container mx-auto max-w-7xl">{children}</div>
    </div>
  );
}

export default AdminTechArticleContent;
