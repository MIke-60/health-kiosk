const express = require('express')
const router = express.Router()
const {db,genid} = require('../db/dbUtils')
const User = require('../entity/User')
const crypto = require('crypto')
const {v4:uuidv4} = require('uuid')

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateToken } = require('../utils/jwtHelper')

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // store catalog
    },
    filename: function (req, file, cb) {
        // 使用原始扩展名
        const ext = path.extname(file.originalname) || '.jpg'; 
        // 可以用 timestamp 或 uuid 保证唯一性
        cb(null, `${Date.now()}${ext}`);
    }
});

const upload = multer({ storage: storage });

/**
 * @api {post} /user/login User Login
 * @apiGroup User
 * 
 * @apiHeader {String} Content-Type multipart/form-data
 * 
 * @apiBody {String} [account] User account (optional if using face login).
 * @apiBody {String} [pwd] User password (required if using account login).
 * @apiBody {File} [photo] User photo for face recognition login (optional if using account login).
 * 
 * @apiSuccess {Object} Response Example (Account Login Success):
 * {
 *   "code": 200,
 *   "msg": "Login successful",
 *   "user": {
 *     "account": "user001",
 *     "name": "Alice",
 *     "role": 1,
 *     "gender": "Female",
 *     "age": 25,
 *     "token": "jwt_or_uuid_token"
 *   }
 * }
 * 
 * @apiSuccess {Object} Response Example (Face Login Success):
 * {
 *   "code": 200,
 *   "msg": "Face match successful",
 *   "user": {
 *     "account": "user001",
 *     "name": "Alice",
 *     "role": 1,
 *     "gender": "Female",
 *     "age": 25,
 *     "token": "jwt_or_uuid_token"
 *   }
 * }
 */
router.post("/login", upload.single("photo") , async (req, res) => {
  //upload.fields([{ name: "photo", maxCount: 1 }])
  let { account, pwd } = req.body;
  console.log("account: " + account+", pwd: " + pwd)
  if(account!=null && pwd !=null){
    //delete picture saved from request.
    if (req.file) {
      const del_file_string = path.join(__dirname, "../uploads/" + req.file?.filename);
      fs.unlink(del_file_string, err => {
        if (err) console.log(err);
      });
    }

    try { 
      const { err, rows } = await db.async.all( 
        "SELECT * FROM user WHERE account = ?", 
        [account] 
      );
      if (err) {
        console.log(err)
        return res.status(500).json({ 
          code: 500, 
          msg: "服务器错误", 
          err 
        }
      ); 
      } 
      if (rows.length === 0) { 
        return res.status(200).json({ 
          code: 404, 
          msg: "不存在该用户" }); 
        } 
      const user = rows[0];
      pwd = crypto.createHash('sha256').update(pwd.toString()).digest('hex');
      if (user.pwd === pwd) { 
        user.pwd = ""
        const token = generateToken({account})
        //token = uuidv4()
        user.token = token
        //const updateSql = "UPDATE `user` SET `token` = ? WHERE `account` = ?";
        //await db.async.run(updateSql, [token, user.account]);
        return res.status(200).json({ 
          code: 200, 
          msg: "登录成功",
          user
        }); 
      } else { 
        return res.status(200).json({ 
          code: 401, 
          msg: "密码错误" 
        }); 
      } 
    } catch (e) { 
      console.log(e.message)
      return res.status(500).json({ 
        code: 500, 
        msg: "服务器错误", 
        err: e.message }
      );
    }
  }else{
    /**
   * Login logic when just having the picture.
   * Using face recognition function to recognize whether a face saved in database is as same as the input picture.
   */
    const py = req.py;
    const callbacks = req.pyCallbacks;

    const file_name = req.file?.filename;

    const faceMatch = () =>
      new Promise((resolve, reject) => {
        callbacks.push((data) => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
        py.stdin.write(JSON.stringify({ action: "compare", file_name }) + "\n");
      });

    try {
      const result = await faceMatch();
      // find user information in MysQL through db_filename
      if (result.status === "ok" && result.match) {
        const file_name = result.match
        const find_user_sql = "select * from `user` where `pic` = ? ;"
        const {err:userErr,rows:userRows} = await db.async.all(find_user_sql,[file_name])

        if(userErr != null || userRows.length == 0){
          return res.status(500).json({
            code: 500,
            msg:"查询用户信息失败"
          });
        }
        const user = userRows[0];
        user.pwd = "";
        const token = generateToken({account})
        //token = uuidv4()
        user.token = token
        //const updateSql = "UPDATE `user` SET `token` = ? WHERE `account` = ?";
        //await db.async.run(updateSql, [token, user.account]);
        //py.kill()
        return res.json({ code: 200, 
          msg: "人脸匹配成功", 
          user 
        });
      } else if (result.status === "ok") {
        console.log(result.a)
        return res.status(404).json({ 
          code: 404, 
          msg: "未找到匹配用户" 
        });
      } else {
        return res.status(500).json({ 
          code: 500, 
          msg: result.msg 
        });
      }
    } catch (e) {
      return res.status(500).json({ 
        code: 500, 
        msg: "Python 服务异常", 
        err: e.message 
      });
    } finally {
      if (req.file) {
        const del_file_string = path.join(__dirname, "../uploads/" + req.file?.filename);
        fs.unlink(del_file_string, err => {
          if (err) console.log(err);
        });
      }
    }
  }
});

/**
 * @api {post} /user/register Register New User
 * @apiGroup User
 * 
 * @apiHeader {String} Content-Type multipart/form-data
 * 
 * @apiBody {String} account User account (required).
 * @apiBody {String} pwd User password (required).
 * @apiBody {File} [photo] User profile photo (optional).
 * 
 * @apiSuccess {Object} Response Example (Success):
 * {
 *   "code": 200,
 *   "msg": "Registration successful"
 * }
 */
router.post("/register", upload.single('photo'), async (req, res) => {
    /** Headers
     * {
        host: '10.0.2.2:3000',
        'content-length': '100971',
        accept: 'application/json',
        'accept-charset': 'UTF-8',
        'user-agent': 'Ktor client',
        'content-type': 'multipart/form-data; boundary=-28cfc474-180e286872297157289b20bd-502d8f1c3bf0cc86-56b70b6558da571f-2'
        }
    */
    let role = 0;
    if(req.file){
      role = 1
      const py = req.py;
      py.stdin.write(JSON.stringify({ action: "encode", file_name: req.file.filename }) + "\n");
    }

    const user = new User(req.body);

    if (!user.account || !user.pwd) {
        return res.status(200).json({
            code: 400,
            msg: "缺少必填字段：account 或 pwd"
        });
    }

    const searchSQL = "SELECT * FROM `user` WHERE `account` = ?;";
    const insertSql = "INSERT INTO `user` (`account`,`name`, `pwd`, `pic`, `role`) VALUES (?, ?, ?, ?, ?);";

    try {
        const { err: searchErr, rows } = await db.async.all(searchSQL, 
            [user.account]
        );

        if (searchErr) {
            return res.status(500).json({
                code: 500,
                msg: "查询用户失败",
                err: searchErr
            });
        }

        if (rows.length > 0) {
            return res.status(200).json({
                code: 409,
                msg: "用户account已存在"
            });
        }

        const { err: insertErr } = await db.async.run(insertSql, 
            [user.account, user.account, user.pwd, req.file?.filename, role]
        );

        if (insertErr) {
            return res.status(500).json({
                code: 500,
                msg: "注册失败",
                err: insertErr
            });
        }

        return res.status(200).json({
            code: 200,
            msg: "注册成功"
        });

    } catch (e) {
        console.log(e)
        return res.status(500).json({
            code: 500,
            msg: "服务器错误",
            err: e.message
        });
    }
});


module.exports = router