var mongoose = require("mongoose");

var campSchema = new mongoose.Schema({
  name: String,
  img: String,
  price: String,
  description: String,
  author: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users"
    },
    username: String

  },
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment"
  }]
});

var Camp = mongoose.model("Camp", campSchema);

module.exports = mongoose.model("Camp", campSchema);
